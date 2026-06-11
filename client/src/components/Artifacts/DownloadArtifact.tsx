import React, { useState } from 'react';
import { CircleCheckBig } from 'lucide-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react';
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
 * Sends a postMessage to the Sandpack preview iframe asking it to run the
 * named download function.  The artifact HTML's message listener installs a
 * one-shot blob interceptor, calls the function, captures the generated file,
 * and postMessages the binary back here.  Artifacts.tsx's window-level listener
 * catches that reply and triggers the actual browser download — no popups or
 * new tabs required.
 */
function triggerViaPreview(
  previewRef: React.MutableRefObject<SandpackPreviewRef | undefined>,
  fnName: string,
): boolean {
  const client = previewRef.current?.getClient();
  // SandpackClient exposes `iframe: HTMLIFrameElement` as a public property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iframeWin = (client as any)?.iframe?.contentWindow as Window | null | undefined;
  if (!iframeWin) {
    return false;
  }
  iframeWin.postMessage({ type: 'artifact-download-request', fn: fnName }, '*');
  return true;
}

const DownloadArtifact = ({
  artifact,
  previewRef,
}: {
  artifact: Artifact;
  previewRef: React.MutableRefObject<SandpackPreviewRef | undefined>;
}) => {
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
    const sent = triggerViaPreview(previewRef, fmt.triggerFn);
    if (!sent) {
      console.warn('[DownloadArtifact] preview iframe not ready — switch to Preview tab and retry');
      return;
    }
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
