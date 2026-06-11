import React, { useState } from 'react';
import { CircleCheckBig } from 'lucide-react';
import type { Artifact } from '~/common';
import { Button } from '@librechat/client';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { useCodeState } from '~/Providers/EditorContext';
import { useLocalize } from '~/hooks';

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
 * Loads the artifact HTML in a zero-size hidden iframe, waits for all CDN
 * scripts to finish, then injects a blob interceptor at runtime via
 * iframe.contentWindow.Function (so it runs after PptxGenJS/SheetJS/docx.js
 * are already loaded — no race condition), and calls the named function.
 *
 * The interceptor patches URL.createObjectURL + HTMLElement.prototype.click
 * to capture the generated file before Chrome can block the subframe download,
 * then postMessages the binary to the parent window.
 *
 * Artifacts.tsx already listens for { type:'artifact-download' } on window
 * and performs the actual download from the top-level context.
 */
function runInHiddenIframe(html: string, fnName: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
  document.body.appendChild(iframe);

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* already removed */
    }
  };

  iframe.onload = () => {
    // Extra buffer for any synchronous post-load initialisation inside the artifact
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = iframe.contentWindow as any;
      if (!win) {
        console.error('[DownloadArtifact] iframe contentWindow unavailable');
        cleanup();
        return;
      }

      if (typeof win[fnName] !== 'function') {
        console.error(
          `[DownloadArtifact] ${fnName} not found — CDN script may have failed to load`,
        );
        cleanup();
        return;
      }

      try {
        // Use iframe's own Function constructor so the code runs in the iframe's
        // global scope (same-origin srcdoc frames allow this).
        // Injecting here — after onload — guarantees CDN scripts are already present.
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
              var filename = el.download;
              var mime = blob.type || 'application/octet-stream';
              var r = new FileReader();
              r.onload = function () {
                var b64 = r.result.split(',')[1];
                window.parent.postMessage(
                  { type: 'artifact-download', filename: filename, data: b64, mimeType: mime },
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
      } catch (err) {
        console.error(`[DownloadArtifact] error invoking ${fnName}:`, err);
      }

      // Keep iframe alive for async file generation + FileReader + postMessage round-trip
      setTimeout(cleanup, 90_000);
    }, 600);
  };

  iframe.srcdoc = html;
}

const DownloadArtifact = ({ artifact }: { artifact: Artifact }) => {
  const localize = useLocalize();
  const { currentCode } = useCodeState();
  const { fileKey: fileName } = useArtifactProps({ artifact });
  const [done, setDone] = useState<string | null>(null);

  const content = currentCode ?? artifact.content ?? '';
  const nativeFormats = detectNativeFormats(content);

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
    runInHiddenIframe(content, fmt.triggerFn);
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
