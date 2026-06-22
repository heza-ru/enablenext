const express = require('express');
const { chromium } = require('playwright-core');
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('@librechat/data-schemas');

const router = express.Router();
router.use(requireJwtAuth);

// ponytail: one shared browser, lazy-init, reused across requests
let browser = null;
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      // Reduce memory footprint for constrained environments (Render free tier)
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    });
  }
  return browser;
}

/**
 * POST /api/artifacts/render
 * Body: { html: string, format: 'pdf' | 'slides' }
 *
 * format=pdf    → responds with application/pdf bytes (one page per .slide)
 * format=slides → responds with { slides: string[] } base64 PNG per .slide element
 *
 * The caller should patchLibUrls() client-side before sending so that /libs/ and
 * /brand/ paths resolve to absolute URLs that Playwright can fetch from localhost.
 */
router.post('/render', async (req, res) => {
  const { html, format = 'pdf' } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'html string is required' });
  }
  if (format !== 'pdf' && format !== 'slides') {
    return res.status(400).json({ error: "format must be 'pdf' or 'slides'" });
  }

  let context;
  try {
    const b = await getBrowser();
    // deviceScaleFactor:2 gives retina-quality screenshots
    context = await b.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 30s hard timeout — large artifacts with CDN deps can be slow
    page.setDefaultNavigationTimeout(30_000);
    page.setDefaultTimeout(30_000);

    await page.setContent(html, { waitUntil: 'networkidle' });
    // Ensure custom fonts are rendered before screenshotting
    await page.evaluate(() => document.fonts.ready);

    if (format === 'pdf') {
      // Emulate screen so backdrop-filter / blend-modes / filters survive print
      await page.emulateMedia({ media: 'screen' });
      // Inject pagination CSS so each .slide becomes its own PDF page
      await page.addStyleTag({
        content: [
          '@page{size:10in 5.625in;margin:0}',
          'html,body{overflow:visible!important;margin:0;padding:0}',
          '.deck{position:relative!important;height:auto!important;overflow:visible!important}',
          '.slide{position:relative!important;inset:auto!important;opacity:1!important;',
          'transform:none!important;display:block!important;',
          'width:100vw!important;height:100vh!important;',
          'page-break-after:always;break-after:page}',
          '.slide:last-child{page-break-after:avoid;break-after:avoid}',
          '.progress-bar,.progress-fill,.slide-counter,.nav-hint,.notes{display:none!important}',
          '*,*::before,*::after{',
          '-webkit-print-color-adjust:exact!important;',
          'print-color-adjust:exact!important}',
        ].join(''),
      });
      const pdfBytes = await page.pdf({
        width: '10in',
        height: '5.625in',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'attachment; filename="slides.pdf"');
      res.send(Buffer.from(pdfBytes));
    } else {
      // Screenshot each .slide element individually
      const count = await page.locator('.slide').count();
      if (count === 0) {
        return res.status(422).json({ error: 'No .slide elements found in the artifact' });
      }
      const slides = [];
      for (let i = 0; i < count; i++) {
        const el = page.locator('.slide').nth(i);
        const png = await el.screenshot({ type: 'png' });
        slides.push(png.toString('base64'));
      }
      res.json({ slides });
    }
  } catch (err) {
    logger.error('[Artifacts] render error', err);
    const msg = err.message || '';
    // Friendly message when Playwright browsers haven't been installed yet
    const friendly = msg.includes("Executable doesn't exist") || msg.includes('browserType.launch')
      ? 'Playwright browsers not installed on this server. Run: npx playwright install chromium'
      : 'Render failed: ' + msg;
    res.status(500).json({ error: friendly });
  } finally {
    await context?.close();
  }
});

module.exports = router;
