import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Download,
  CircleCheckBig,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Presentation,
  Code2,
} from 'lucide-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { Artifact } from '~/common';
import { Button } from '@librechat/client';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { useCodeState } from '~/Providers/EditorContext';
import { useLocalize } from '~/hooks';

type NativeFormat = {
  label: string;
  ext: string;
  mimeType: string;
  triggerFn: string;
  Icon: React.ElementType;
};

const NATIVE_FORMATS: NativeFormat[] = [
  {
    label: 'PowerPoint (.pptx)',
    ext: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    triggerFn: 'downloadPptx',
    Icon: Presentation,
  },
  {
    label: 'Excel (.xlsx)',
    ext: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    triggerFn: 'downloadExcel',
    Icon: FileSpreadsheet,
  },
  {
    label: 'Word (.docx)',
    ext: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    triggerFn: 'downloadDocx',
    Icon: FileText,
  },
];

function detectNativeFormats(content: string): NativeFormat[] {
  return NATIVE_FORMATS.filter((f) => content.includes(f.triggerFn));
}

/** Wait up to `ms` for the Sandpack client's iframe to become available */
function waitForIframe(
  previewRef: React.MutableRefObject<SandpackPreviewRef>,
  ms = 4000,
): Promise<HTMLIFrameElement | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + ms;
    const tick = () => {
      const client = previewRef.current?.getClient?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const iframe = (client as any)?.iframe as HTMLIFrameElement | undefined;
      if (iframe?.contentWindow) {
        resolve(iframe);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

const DownloadArtifact = ({
  artifact,
  previewRef,
}: {
  artifact: Artifact;
  previewRef?: React.MutableRefObject<SandpackPreviewRef>;
}) => {
  const localize = useLocalize();
  const { currentCode } = useCodeState();
  const { fileKey: fileName } = useArtifactProps({ artifact });
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);

  const content = currentCode ?? artifact.content ?? '';
  const nativeFormats = detectNativeFormats(content);
  const hasNative = nativeFormats.length > 0;

  // Position the portal menu under the trigger button
  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 9999,
      minWidth: 210,
    });
  }, []);

  const handleOpen = () => {
    updateMenuPosition();
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const flashDone = () => {
    setIsDownloaded(true);
    setOpen(false);
    setTimeout(() => setIsDownloaded(false), 2500);
  };

  const downloadHtml = () => {
    try {
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
      flashDone();
    } catch (err) {
      console.error('HTML download failed:', err);
    }
  };

  const triggerNativeDownload = async (format: NativeFormat) => {
    if (!previewRef) {
      downloadHtml();
      return;
    }
    setOpen(false);
    const iframe = await waitForIframe(previewRef);
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'artifact-trigger-download', fn: format.triggerFn },
        '*',
      );
      flashDone();
    } else {
      // iframe never became available — fall back to HTML
      downloadHtml();
    }
  };

  // Simple icon-only button when no native formats available
  if (!hasNative) {
    return (
      <Button
        size="icon"
        variant="ghost"
        onClick={downloadHtml}
        aria-label={localize('com_ui_download_artifact')}
      >
        {isDownloaded ? (
          <CircleCheckBig size={16} aria-hidden="true" />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
      </Button>
    );
  }

  const menu = open
    ? ReactDOM.createPortal(
        <div
          className="overflow-hidden rounded-lg border border-border-light bg-surface-primary shadow-xl"
          style={menuStyle}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Download as
          </p>
          {nativeFormats.map((fmt) => (
            <button
              key={fmt.ext}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => triggerNativeDownload(fmt)}
            >
              <fmt.Icon size={15} className="shrink-0 text-text-secondary" />
              {fmt.label}
            </button>
          ))}
          <div className="mx-3 my-1 border-t border-border-light" />
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={downloadHtml}
          >
            <Code2 size={15} className="shrink-0 text-text-secondary" />
            HTML source
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div ref={triggerRef} className="flex items-center">
        {/* Primary: download in first detected native format */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 rounded-r-none border-r border-border-light px-2 text-xs"
          onClick={() => triggerNativeDownload(nativeFormats[0])}
          aria-label={`Download as ${nativeFormats[0].ext.toUpperCase()}`}
        >
          {isDownloaded ? (
            <CircleCheckBig size={14} aria-hidden="true" />
          ) : (
            <Download size={14} aria-hidden="true" />
          )}
          <span>{nativeFormats[0].ext.toUpperCase()}</span>
        </Button>

        {/* Chevron: open format menu */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 rounded-l-none px-1"
          onClick={open ? () => setOpen(false) : handleOpen}
          aria-label="More download options"
          aria-expanded={open}
        >
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>

      {menu}
    </>
  );
};

export default DownloadArtifact;
