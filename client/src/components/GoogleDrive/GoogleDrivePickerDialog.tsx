import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, Loader2 } from 'lucide-react';
import { apiBaseUrl } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import {
  OGDialog,
  OGDialogTitle,
  OGDialogPortal,
  OGDialogOverlay,
  OGDialogContent,
  Button,
} from '@librechat/client';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  iconLink?: string;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected?: (files: DriveFile[]) => void;
  isDownloading?: boolean;
  maxSelectionCount?: number;
}

function mimeLabel(mimeType: string): string {
  if (mimeType.includes('document')) return 'Doc';
  if (mimeType.includes('spreadsheet')) return 'Sheet';
  if (mimeType.includes('presentation')) return 'Slides';
  if (mimeType.includes('pdf')) return 'PDF';
  return 'File';
}

export default function GoogleDrivePickerDialog({
  isOpen,
  onOpenChange,
  onFilesSelected,
  isDownloading = false,
  maxSelectionCount,
}: Props) {
  const { token } = useAuthContext();
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(
    async (pageToken?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set('query', query);
        if (pageToken) params.set('pageToken', pageToken);
        const res = await fetch(`${apiBaseUrl()}/api/drive/files?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load Drive files');
        const data = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
        setFiles((prev) => (pageToken ? [...prev, ...(data.files ?? [])] : (data.files ?? [])));
        setNextPageToken(data.nextPageToken ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoading(false);
      }
    },
    [query, token],
  );

  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setSelected(new Set());
      fetchFiles();
    }
  }, [isOpen, fetchFiles]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (!maxSelectionCount || next.size < maxSelectionCount) {
        next.add(id);
      }
      return next;
    });
  };

  const handleAttach = () => {
    const selectedFiles = files.filter((f) => selected.has(f.id));
    onFilesSelected?.(selectedFiles);
    onOpenChange(false);
  };

  return (
    <OGDialog open={isOpen} onOpenChange={onOpenChange}>
      <OGDialogPortal>
        <OGDialogOverlay className="bg-black/50" />
        <OGDialogContent className="fixed left-1/2 top-1/2 z-50 flex h-[560px] w-[600px] max-h-[90vh] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border bg-surface-primary p-4 shadow-lg focus:outline-none">
          <OGDialogTitle className="text-base font-semibold">Google Drive</OGDialogTitle>

          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              type="text"
              placeholder="Search files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
              className="w-full rounded-md border bg-surface-primary pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex-1 divide-y overflow-y-auto rounded-md border">
            {error && <p className="p-4 text-sm text-red-500">{error}</p>}
            {loading && files.length === 0 && (
              <div className="flex items-center justify-center p-8">
                <Loader2 size={20} className="animate-spin text-text-secondary" />
              </div>
            )}
            {!loading && files.length === 0 && !error && (
              <p className="p-4 text-sm text-text-secondary">No files found.</p>
            )}
            {files.map((file) => (
              <label
                key={file.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  className="rounded"
                />
                <FileText size={15} className="shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{file.name}</p>
                  <p className="text-xs text-text-secondary">
                    {mimeLabel(file.mimeType)}
                    {file.modifiedTime &&
                      ` · ${new Date(file.modifiedTime).toLocaleDateString()}`}
                  </p>
                </div>
              </label>
            ))}
            {nextPageToken && !loading && (
              <button
                onClick={() => fetchFiles(nextPageToken)}
                className="w-full py-2 text-sm text-primary hover:underline"
              >
                Load more
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {selected.size} selected{maxSelectionCount ? ` / ${maxSelectionCount}` : ''}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={selected.size === 0 || isDownloading} onClick={handleAttach}>
                {isDownloading ? (
                  <>
                    <Loader2 size={13} className="mr-1 animate-spin" /> Attaching...
                  </>
                ) : (
                  `Attach${selected.size > 0 ? ` (${selected.size})` : ''}`
                )}
              </Button>
            </div>
          </div>
        </OGDialogContent>
      </OGDialogPortal>
    </OGDialog>
  );
}
