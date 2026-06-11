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
 * Opens a 1×1 off-screen popup, writes the full artifact HTML into it, waits for
 * all CDN scripts (PptxGenJS / SheetJS / docx.js) to load, then calls the named
 * download function.  Popup windows are top-level browsing contexts — Chrome never
 * blocks their blob downloads regardless of async timing or user-activation state.
 * window.open() is called synchronously from the button's onClick, so the browser
 * treats it as user-activated and does not trigger the popup blocker.
 */
function runInPopup(html: string, fnName: string): void {
  const popup = window.open(
    '',
    '_blank',
    'width=1,height=1,left=-9999,top=-9999,menubar=no,toolbar=no,location=no,scrollbars=no,status=no',
  );
  if (!popup) {
    console.error('[DownloadArtifact] popup blocked — allow popups for this site to use native downloads');
    return;
  }

  const run = () => {
    setTimeout(() => {
      try {
        (popup as any)[fnName]?.();
      } catch (e) {
        console.error('[DownloadArtifact] could not invoke', fnName, e);
      }
      // Keep popup alive while async file generation finishes, then close
      setTimeout(() => {
        try {
          popup.close();
        } catch {
          /* already closed */
        }
      }, 90_000);
    }, 500);
  };

  // document.open/write/close on a blank window creates a new document; the
  // browser fetches CDN scripts and fires window.load when everything is ready.
  // onload is set before document.write so it is in place before loading starts.
  popup.onload = run;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
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
    runInPopup(content, fmt.triggerFn);
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
