import React, { useState, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { CircleCheckBig } from 'lucide-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { Artifact } from '~/common';
import { Button } from '@librechat/client';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { useCodeState } from '~/Providers/EditorContext';
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
 * Replace CDN URLs for known libraries with the locally-hosted copies.
 * srcdoc iframes on Vercel cannot load from external CDNs blocked by CSP.
 * The local bundle is served from the same origin so it always loads.
 */
function patchLibUrls(html: string): string {
  const origin = window.location.origin;
  // pptxgenjs — any version from any permitted CDN
  const patched = html.replace(
    /https?:\/\/(?:cdnjs\.cloudflare\.com\/ajax\/libs\/pptxgenjs\/[^\s"'>]+|unpkg\.com\/pptxgenjs[^\s"'>]*|cdn\.jsdelivr\.net\/npm\/pptxgenjs[^\s"'>]*)/g,
    `${origin}/libs/pptxgen.bundle.js`,
  );
  console.log(
    `${LOG} [hiddenIframe] patchLibUrls — pptxgenjs CDN replaced: ${patched !== html}`,
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

  return (
    <div className="flex items-center gap-1">
      {nativeFormats.map((fmt) => (
        <Button
          key={fmt.ext}
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs font-medium"
          onClick={() => downloadNative(fmt)}
          aria-label={`Download as ${fmt.label}`}
        >
          {done === fmt.ext && <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />}
          {fmt.label}
        </Button>
      ))}
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
