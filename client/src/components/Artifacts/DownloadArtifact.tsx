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
 * Injected into the hidden iframe before any other script runs.
 * Intercepts blob URL downloads (via anchor click OR dispatchEvent)
 * and posts the base64 data to window.parent instead of triggering a
 * sandboxed download — works with pptx.writeFile(), XLSX.writeFile(),
 * Packer.toBlob()+a.click(), and FileSaver.js.
 */
const INTERCEPTOR_SCRIPT = `<script>
(function(){
  var _blobs = new Map();

  // Track every blob that gets a URL so we can read it back
  var _origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(b) {
    var u = _origCreate(b);
    if (b instanceof Blob) _blobs.set(u, b);
    return u;
  };
  var _origRevoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function(u) {
    // Don't delete immediately — FileReader may still need the blob
    setTimeout(function(){ _blobs.delete(u); }, 60000);
    _origRevoke(u);
  };

  function intercept(anchor) {
    var href = anchor.href || anchor.getAttribute('href') || '';
    if (!anchor.download || !href.startsWith('blob:')) return false;
    var blob = _blobs.get(href);
    if (!blob) return false;
    var filename = anchor.download;
    var mimeType = blob.type ||
      (filename.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
       filename.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
       filename.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
       'application/octet-stream');
    var reader = new FileReader();
    reader.onload = function() {
      if (typeof reader.result !== 'string') return;
      window.parent.postMessage({
        type: 'artifact-download',
        filename: filename,
        data: reader.result.split(',')[1],
        mimeType: mimeType,
      }, '*');
    };
    reader.readAsDataURL(blob);
    return true;
  }

  // Patch 1: HTMLAnchorElement.prototype.click (used by SheetJS, docx.js user code)
  var _origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    if (!intercept(this)) _origClick.call(this);
  };

  // Patch 2: EventTarget.prototype.dispatchEvent (used by FileSaver / PptxGenJS)
  var _origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function(evt) {
    if (evt && evt.type === 'click' && this.tagName === 'A') {
      if (intercept(this)) return true;
    }
    return _origDispatch.call(this, evt);
  };
})();
<\/script>`;

/**
 * Prepends the interceptor script right after <head> so it runs before any
 * library scripts (PptxGenJS / SheetJS / docx.js) load.
 */
function injectInterceptor(html: string): string {
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>\n' + INTERCEPTOR_SCRIPT);
  }
  // Fallback: prepend before everything
  return INTERCEPTOR_SCRIPT + '\n' + html;
}

/**
 * Loads the artifact HTML in a zero-size, non-sandboxed iframe so that
 * external scripts (PptxGenJS / SheetJS / docx.js) load and execute normally.
 * The injected interceptor posts blob data back to the parent window.
 * The iframe is removed 60 s after load.
 */
function runInHiddenIframe(html: string, fnName: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;width:1px;height:1px;border:0;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
  document.body.appendChild(iframe);

  iframe.onload = () => {
    // 400 ms lets synchronous scripts finish executing after DOMContentLoaded
    setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (iframe.contentWindow as any)?.[fnName]?.();
      } catch (e) {
        console.error('[DownloadArtifact] could not call', fnName, e);
      }
      // Keep iframe alive long enough for async operations (pptx build, etc.)
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          /* already removed */
        }
      }, 60_000);
    }, 400);
  };

  iframe.srcdoc = injectInterceptor(html);
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
