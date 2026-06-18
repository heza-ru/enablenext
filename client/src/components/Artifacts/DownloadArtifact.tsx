import React, { useState, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { CircleCheckBig, Loader2 } from 'lucide-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { Artifact } from '~/common';
import { Button } from '@librechat/client';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { useCodeState } from '~/Providers/EditorContext';
import { apiBaseUrl } from 'librechat-data-provider';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

const LOG = '[DownloadArtifact]';

type NativeFormat = {
  label: string;
  ext: string;
  triggerFn: string;
};

const NATIVE_FORMATS: NativeFormat[] = [
  { label: 'PPTX', ext: 'pptx', triggerFn: 'downloadPptx' },
  { label: 'XLSX', ext: 'xlsx', triggerFn: 'downloadExcel' },
  { label: 'DOCX', ext: 'docx', triggerFn: 'downloadDocx' },
];

function detectNativeFormats(content: string): NativeFormat[] {
  return NATIVE_FORMATS.filter((f) => content.includes(f.triggerFn));
}

/**
 * Primary approach: postMessage to the live Sandpack preview iframe.
 *
 * The artifact HTML (from the presentation-creator skill) has a built-in listener:
 *   window.addEventListener('message', e => {
 *     if (e.data.type === 'artifact-download-request') { intercept blob, reply }
 *   })
 * It postMessages { type: 'artifact-download', filename, data, mimeType } to e.source,
 * which is the app window. Artifacts.tsx catches that and triggers the real download.
 *
 * Returns true if the postMessage was dispatched, false if the iframe was unavailable.
 */
function triggerViaPreviewIframe(
  previewRef: MutableRefObject<SandpackPreviewRef | undefined>,
  fnName: string,
): boolean {
  console.log(`${LOG} [postMessage] Attempting ${fnName} via Sandpack preview iframe`);

  const client = previewRef.current?.getClient();
  if (!client) {
    console.warn(`${LOG} [postMessage] No Sandpack client — preview not yet initialised`);
    return false;
  }

  // SandpackClient base class exposes .iframe (HTMLIFrameElement)
  const iframeEl = (client as unknown as { iframe?: HTMLIFrameElement }).iframe;
  if (!iframeEl) {
    console.warn(`${LOG} [postMessage] client.iframe is absent`);
    return false;
  }

  const iframeWindow = iframeEl.contentWindow;
  if (!iframeWindow) {
    console.warn(`${LOG} [postMessage] iframe.contentWindow is null`);
    return false;
  }

  console.log(
    `${LOG} [postMessage] Dispatching { type: 'artifact-download-request', fn: '${fnName}' } to preview iframe`,
  );
  iframeWindow.postMessage({ type: 'artifact-download-request', fn: fnName }, '*');
  return true;
}

/**
 * Fallback: load the artifact HTML in a zero-size hidden iframe, inject a blob
 * interceptor after all scripts have loaded, then call the named function.
 *
 * Used when:
 *   (a) previewRef / SandpackClient / iframe is unavailable, OR
 *   (b) the primary postMessage received no artifact-download response within FALLBACK_MS
 *       (older artifacts without the built-in message listener).
 *
 * Returns a cleanup function that removes the iframe.
 */
const FALLBACK_MS = 10_000;

/**
 * Patch an HTML string so it works when run outside the Sandpack iframe:
 *  - Replace CDN pptxgenjs with the locally-hosted bundle
 *  - Rewrite relative /brand/ and /libs/ asset paths to absolute app-origin URLs
 *  - Inject window._BRAND_ORIGIN so the presentation script's _getOrigin() returns
 *    the correct origin even when running inside a sandboxed iframe
 */
function patchLibUrls(html: string): string {
  const origin = window.location.origin;

  // pptxgenjs — any version from any permitted CDN → local bundle
  let patched = html.replace(
    /https?:\/\/(?:cdnjs\.cloudflare\.com\/ajax\/libs\/pptxgenjs\/[^\s"'>]+|unpkg\.com\/pptxgenjs[^\s"'>]*|cdn\.jsdelivr\.net\/npm\/pptxgenjs[^\s"'>]*)/g,
    `${origin}/libs/pptxgen.bundle.js`,
  );

  // Relative /brand/ and /libs/ paths in HTML attributes (src="…") and CSS url(…)
  patched = patched
    .replace(/(src=['"])\/brand\//g, `$1${origin}/brand/`)
    .replace(/(src=['"])\/libs\//g, `$1${origin}/libs/`)
    .replace(/(url\(['"]?)\/brand\//g, `$1${origin}/brand/`)
    .replace(/(url\(['"]?)\/libs\//g, `$1${origin}/libs/`);

  // Inject _BRAND_ORIGIN before </head> so the JS fetch path uses the right origin
  const originTag = `<script>window._BRAND_ORIGIN=${JSON.stringify(origin)};</script>`;
  patched = patched.replace(/<\/head>/i, `${originTag}</head>`);

  console.log(
    `${LOG} [patchLibUrls] pptxgenjs CDN replaced: ${patched !== html}`,
  );
  return patched;
}

function runInHiddenIframe(html: string, fnName: string): () => void {
  const patchedHtml = patchLibUrls(html);
  console.log(`${LOG} [hiddenIframe] Creating hidden iframe to run ${fnName}`);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
  document.body.appendChild(iframe);

  let cleanupCalled = false;
  const cleanup = () => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    console.log(`${LOG} [hiddenIframe] Removing hidden iframe`);
    try {
      document.body.removeChild(iframe);
    } catch {
      /* already removed */
    }
  };

  iframe.onload = () => {
    console.log(`${LOG} [hiddenIframe] onload fired — waiting 800 ms for post-load init`);
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = iframe.contentWindow as any;
      if (!win) {
        console.error(`${LOG} [hiddenIframe] contentWindow is null after load`);
        cleanup();
        return;
      }

      // Diagnose which CDN libraries actually loaded
      const pptxLoaded = typeof win['PptxGenJS'] !== 'undefined';
      const xlsxLoaded = typeof win['XLSX'] !== 'undefined';
      const docxLoaded = typeof win['docx'] !== 'undefined';
      console.log(
        `${LOG} [hiddenIframe] CDN globals — PptxGenJS: ${pptxLoaded}, XLSX: ${xlsxLoaded}, docx: ${docxLoaded}`,
      );

      if (typeof win[fnName] !== 'function') {
        console.error(
          `${LOG} [hiddenIframe] '${fnName}' is not a function. ` +
            `Ensure the artifact HTML defines this function in a <script> block.`,
        );
        cleanup();
        return;
      }

      console.log(`${LOG} [hiddenIframe] Injecting blob interceptor then calling ${fnName}()`);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IframeFunction = win.Function as any;
        IframeFunction(`
          (function () {
            var B = new Map();
            var origCreate = URL.createObjectURL.bind(URL);
            URL.createObjectURL = function (b) {
              var u = origCreate(b);
              if (b instanceof Blob) B.set(u, b);
              return u;
            };
            var origRevoke = URL.revokeObjectURL.bind(URL);
            URL.revokeObjectURL = function (u) {
              setTimeout(function () { B.delete(u); }, 90000);
              origRevoke(u);
            };
            function intercept(el) {
              if (!el.download || !el.href || el.href.indexOf('blob:') !== 0) return false;
              var blob = B.get(el.href);
              if (!blob) return false;
              console.log('[hiddenIframe interceptor] Captured blob:', el.download, blob.type, blob.size + ' bytes');
              var r = new FileReader();
              r.onload = function () {
                var b64 = r.result.split(',')[1];
                window.parent.postMessage(
                  { type: 'artifact-download', filename: el.download, data: b64, mimeType: blob.type || 'application/octet-stream' },
                  '*'
                );
                URL.createObjectURL = origCreate;
                HTMLElement.prototype.click = origClick;
              };
              r.readAsDataURL(blob);
              return true;
            }
            var origClick = HTMLElement.prototype.click;
            HTMLElement.prototype.click = function () {
              if (this.tagName === 'A' && intercept(this)) return;
              origClick.call(this);
            };
            var origDispatch = EventTarget.prototype.dispatchEvent;
            EventTarget.prototype.dispatchEvent = function (ev) {
              if (ev && ev.type === 'click' && this.tagName === 'A' && intercept(this)) return true;
              return origDispatch.call(this, ev);
            };
          })();
        `)();

        win[fnName]();
        console.log(`${LOG} [hiddenIframe] ${fnName}() invoked — waiting for blob interception`);
      } catch (err) {
        console.error(`${LOG} [hiddenIframe] Error invoking ${fnName}:`, err);
      }

      // Keep iframe alive for async file generation + FileReader + postMessage round-trip
      setTimeout(cleanup, 90_000);
    }, 800);
  };

  iframe.srcdoc = patchedHtml;
  return cleanup;
}

const DownloadArtifact = ({
  artifact,
  previewRef,
}: {
  artifact: Artifact;
  previewRef?: MutableRefObject<SandpackPreviewRef | undefined>;
}) => {
  const localize = useLocalize();
  const { currentCode } = useCodeState();
  const { fileKey: fileName } = useArtifactProps({ artifact });
  const [done, setDone] = useState<string | null>(null);
  const { data: startupConfig } = useGetStartupConfig();
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveSaving, setDriveSaving] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Timer that arms the hidden-iframe fallback if postMessage gets no response
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cleanup fn for any in-flight hidden iframe
  const iframeCleanupRef = useRef<(() => void) | null>(null);

  const content = currentCode ?? artifact.content ?? '';
  const nativeFormats = detectNativeFormats(content);

  // When an artifact-download message arrives, the postMessage approach worked —
  // cancel any pending hidden-iframe fallback timer.
  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (e.data?.type !== 'artifact-download') return;
      if (fallbackTimerRef.current) {
        console.log(
          `${LOG} artifact-download received — postMessage succeeded, cancelling fallback timer`,
        );
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      iframeCleanupRef.current?.();
    };
  }, []);

  const flash = (key: string) => {
    setDone(key);
    setTimeout(() => setDone(null), 2500);
  };

  const saveToDrive = (fmt: NativeFormat) => {
    setDriveSaving(fmt.ext);
    setDriveLink(null);
    setDriveError(null);

    // Cancel any previous in-flight hidden iframe
    iframeCleanupRef.current?.();
    iframeCleanupRef.current = null;

    const handler = async (e: MessageEvent) => {
      if (e.data?.type !== 'artifact-download') return;
      if (!String(e.data.filename ?? '').toLowerCase().endsWith(`.${fmt.ext}`)) return;
      window.removeEventListener('message', handler);
      try {
        const res = await fetch(`${apiBaseUrl()}/api/drive/files/upload`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: e.data.filename, ext: fmt.ext, data: e.data.data }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || 'Upload failed');
        }
        const { webViewLink } = (await res.json()) as { webViewLink: string };
        setDriveLink(webViewLink);
      } catch (err) {
        console.error('[DownloadArtifact] Drive upload error', err);
        setDriveError(err instanceof Error ? err.message : 'Drive upload failed');
      } finally {
        setDriveSaving(null);
      }
    };
    window.addEventListener('message', handler);
    // Use hidden iframe directly so the blob interceptor captures the file
    // without triggering a local browser download as a side effect
    iframeCleanupRef.current = runInHiddenIframe(content, fmt.triggerFn);
  };

  /**
   * Static PDF export: inject landscape print CSS + auto-print script into the
   * artifact HTML and open it in a new tab. The browser's "Save as PDF" dialog
   * (triggered automatically after ~1s) renders the full design pixel-perfectly
   * since it uses the browser engine rather than PptxGenJS coordinate mapping.
   */
  const printPdf = () => {
    if (!content) return;

    // Injected into the print tab. @page sets the CSS viewport to exactly
    // DESIGN_W × DESIGN_H px (10in × 5.625in at 96 dpi = 960 × 540 px), which
    // matches the slide authoring dimensions — no zoom is needed or applied.
    // Applying zoom to <html> would shrink the deck below the window/page width,
    // leaving the body background exposed as a visible bar on the right side.
    const PRINT_SETUP_SCRIPT = `<script>
(function () {
  window.addEventListener('load', function () {
    var s = document.createElement('style');
    s.textContent =
      '@media print{' +
      '@page{size:10in 5.625in;margin:0}' +
      'html,body{overflow:visible!important}' +
      '.deck{position:relative!important;height:auto!important;overflow:visible!important}' +
      '.slide{position:relative!important;inset:auto!important;opacity:1!important;' +
      'transform:none!important;display:block!important;' +
      'width:100vw!important;height:100vh!important;' +
      'page-break-after:always;break-after:page}' +
      '.slide:last-child{page-break-after:avoid;break-after:avoid}' +
      '.progress-bar,.progress-fill,.slide-counter,.nav-hint,.notes{display:none!important}' +
      '*,*::before,*::after{' +
      '-webkit-print-color-adjust:exact!important;' +
      'print-color-adjust:exact!important;' +
      'color-adjust:exact!important}}';
    document.head.appendChild(s);
    setTimeout(function () { window.print(); }, 1200);
  });
}());
</script>`;

    const printHtml = patchLibUrls(content)
      .replace(/<\/head>/i, PRINT_SETUP_SCRIPT + '</head>');
    const blob = new Blob([printHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    // Use an anchor click instead of window.open — browsers do not block anchor-based
    // navigation triggered from a user gesture, whereas window.open is often suppressed
    // by popup blockers even inside a direct click handler.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Keep the blob URL alive long enough for the new tab to finish loading
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    flash('pdf');
  };

  const downloadHtml = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    flash('html');
  };

  const downloadNative = (fmt: NativeFormat) => {
    console.log(`${LOG} Download requested: ${fmt.label} (triggerFn: ${fmt.triggerFn})`);
    console.log(`${LOG} content length: ${content.length}, has previewRef: ${!!previewRef}`);

    // Cancel any previous in-flight attempt before starting a new one
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    iframeCleanupRef.current?.();
    iframeCleanupRef.current = null;

    if (previewRef) {
      const sent = triggerViaPreviewIframe(
        previewRef as MutableRefObject<SandpackPreviewRef | undefined>,
        fmt.triggerFn,
      );
      if (sent) {
        console.log(
          `${LOG} postMessage dispatched — hidden-iframe fallback armed for ${FALLBACK_MS} ms`,
        );
        fallbackTimerRef.current = setTimeout(() => {
          console.warn(
            `${LOG} No artifact-download message after ${FALLBACK_MS} ms. ` +
              `The artifact may not have the message listener. Running hidden-iframe fallback.`,
          );
          fallbackTimerRef.current = null;
          iframeCleanupRef.current = runInHiddenIframe(content, fmt.triggerFn);
        }, FALLBACK_MS);
        flash(fmt.ext);
        return;
      }
      console.warn(`${LOG} postMessage unavailable — falling back to hidden iframe immediately`);
    } else {
      console.log(`${LOG} No previewRef provided — using hidden iframe`);
    }

    iframeCleanupRef.current = runInHiddenIframe(content, fmt.triggerFn);
    flash(fmt.ext);
  };

  // Show PDF button only for presentations (which have downloadPptx)
  const isPresentationArtifact = nativeFormats.some((f) => f.triggerFn === 'downloadPptx');

  return (
    <div className="flex items-center gap-1">
      {nativeFormats.map((fmt) => (
        <React.Fragment key={fmt.ext}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-medium"
            onClick={() => downloadNative(fmt)}
            aria-label={`Download as ${fmt.label}`}
          >
            {done === fmt.ext && <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />}
            {fmt.label}
          </Button>
          {startupConfig?.googleDrivePickerEnabled && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-medium"
              onClick={() => saveToDrive(fmt)}
              disabled={driveSaving === fmt.ext}
              aria-label={`Save ${fmt.label} to Google Drive`}
            >
              {driveSaving === fmt.ext && <Loader2 size={12} className="mr-1 animate-spin" />}
              {driveSaving === fmt.ext ? 'Saving...' : 'Drive'}
            </Button>
          )}
          {driveError && driveSaving === null && (
            <span className="flex h-7 items-center px-2 text-xs text-red-500" title={driveError}>
              Drive failed
            </span>
          )}
          {driveLink && driveSaving === null && (
            <a
              href={driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 items-center px-2 text-xs font-medium text-primary hover:underline"
            >
              Open ↗
            </a>
          )}
        </React.Fragment>
      ))}
      {isPresentationArtifact && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs font-medium"
          onClick={printPdf}
          aria-label="Export as PDF (opens print dialog)"
          title="Opens in a new tab — use browser Save as PDF for pixel-perfect output"
        >
          {done === 'pdf' && <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />}
          PDF
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs font-medium"
        onClick={downloadHtml}
        aria-label={localize('com_ui_download_artifact')}
      >
        {done === 'html' && <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />}
        HTML
      </Button>
    </div>
  );
};

export default DownloadArtifact;
