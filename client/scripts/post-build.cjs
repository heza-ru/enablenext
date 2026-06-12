const fs = require('fs-extra');
const path = require('path');

async function postBuild() {
  try {
    await fs.copy('public/assets', 'dist/assets');
    await fs.copy('public/robots.txt', 'dist/robots.txt');
    await fs.copy('public/libs', 'dist/libs');

    // Brand fonts — embedded in PPTX for Google Slides compatibility
    const brandFonts = path.resolve(__dirname, '../../brand/fonts/Aeonik');
    await fs.ensureDir('dist/libs/fonts');
    await fs.copy(path.join(brandFonts, 'Aeonik-Regular.ttf'), 'dist/libs/fonts/Aeonik-Regular.ttf');
    await fs.copy(path.join(brandFonts, 'Aeonik-Medium.ttf'),  'dist/libs/fonts/Aeonik-Medium.ttf');
    await fs.copy(path.join(brandFonts, 'Aeonik-Bold.ttf'),    'dist/libs/fonts/Aeonik-Bold.ttf');
    await fs.copy(path.join(brandFonts, 'Aeonik-Light.ttf'),   'dist/libs/fonts/Aeonik-Light.ttf');

    // Brand graphics — used in HTML slides and PPTX image embeds
    const gfx = path.resolve(__dirname, '../../brand/graphics/Whatfix Product Graphic');
    await fs.ensureDir('dist/brand');

    // Product Suite composites
    await fs.copy(path.join(gfx, 'Product Suite Graphic/Dark Mode/PNG/Product Suite Graphic.png'),            'dist/brand/product-suite-dark.png');
    await fs.copy(path.join(gfx, 'Product Suite Graphic/Dark Mode/PNG/Product Suite Graphic_AI Agents.png'),  'dist/brand/ai-agents-suite-dark.png');
    await fs.copy(path.join(gfx, 'Product Suite Graphic/Dark Mode/PNG/Product Suite Graphic_screensense.png'),'dist/brand/screensense-suite-dark.png');
    await fs.copy(path.join(gfx, 'Product Suite Graphic/Dark Mode/PNG/Product Suite Graphic_Product Suite.png'),'dist/brand/product-suite-full-dark.png');
    await fs.copy(path.join(gfx, 'Product Suite Graphic/Light Mode/PNG/Product Suite Graphic.png'),           'dist/brand/product-suite-light.png');
    await fs.copy(path.join(gfx, 'Product Suite Graphic/Light Mode/PNG/Product Suite Graphic_AI Agents.png'), 'dist/brand/ai-agents-suite-light.png');

    // AI Agent logos (dark bg)
    await fs.copy(path.join(gfx, 'AI Agents Logos/Dark Mode/PNG/Authoring_Agent_color.png'),                  'dist/brand/authoring-agent-dark.png');
    await fs.copy(path.join(gfx, 'AI Agents Logos/Dark Mode/PNG/Guidance_Agent_color.png'),                   'dist/brand/guidance-agent-dark.png');
    await fs.copy(path.join(gfx, 'AI Agents Logos/Dark Mode/PNG/Insights_Agent_color.png'),                   'dist/brand/insights-agent-dark.png');
    await fs.copy(path.join(gfx, 'AI Agents Logos/Dark Mode/PNG/Authoring_Agent_color_box_darkBackground.png'),'dist/brand/authoring-agent-box-dark.png');
    await fs.copy(path.join(gfx, 'AI Agents Logos/Dark Mode/PNG/Guidance_Agent_color_box_darkBackground.png'), 'dist/brand/guidance-agent-box-dark.png');
    await fs.copy(path.join(gfx, 'AI Agents Logos/Dark Mode/PNG/Insights_Agent_color_box_darkBackground.png'), 'dist/brand/insights-agent-box-dark.png');

    // AI Agent logos (light bg)
    await fs.copy(path.join(gfx, 'AI Agents Logos/Light Mode/PNG/Authoring_Agent_color.png'),  'dist/brand/authoring-agent-light.png');
    await fs.copy(path.join(gfx, 'AI Agents Logos/Light Mode/PNG/Guidance_Agent_color.png'),   'dist/brand/guidance-agent-light.png');
    await fs.copy(path.join(gfx, 'AI Agents Logos/Light Mode/PNG/Insights_Agent_color.png'),   'dist/brand/insights-agent-light.png');

    // Product logos
    await fs.copy(path.join(gfx, 'Product Logos/DAP/Dark Mode/DAP.png'),                      'dist/brand/dap-dark.png');
    await fs.copy(path.join(gfx, 'Product Logos/DAP/Light Mode/DAP.png'),                     'dist/brand/dap-light.png');
    await fs.copy(path.join(gfx, 'Product Logos/Mirror/Dark Mode/Mirror.png'),                 'dist/brand/mirror-dark.png');
    await fs.copy(path.join(gfx, 'Product Logos/Mirror/Light Mode/Mirror.png'),                'dist/brand/mirror-light.png');
    await fs.copy(path.join(gfx, 'Product Logos/ScreenSense/Dark Mode/ScreenSense.png'),       'dist/brand/screensense-dark.png');
    await fs.copy(path.join(gfx, 'Product Logos/ScreenSense/Light Mode/ScreenSense.png'),      'dist/brand/screensense-light.png');
    await fs.copy(path.join(gfx, 'Product Logos/Product Analytics/Dark Mode/ProductAnalytics.png'), 'dist/brand/product-analytics-dark.png');
    await fs.copy(path.join(gfx, 'Product Logos/Product Analytics/Light Mode/ProductAnalytics.png'),'dist/brand/product-analytics-light.png');

    console.log('✅ PWA icons, robots.txt, libs, brand fonts, and brand graphics copied successfully.');
  } catch (err) {
    console.error('❌ Error copying files:', err);
    process.exit(1);
  }
}

postBuild();
