import { useState, useCallback } from 'react';
import { apiBaseUrl } from 'librechat-data-provider';
import { useFileHandling } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export default function useGoogleDriveFileHandling() {
  const { token } = useAuthContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleFiles } = useFileHandling();

  const handleDriveFiles = useCallback(
    async (driveFiles: DriveFile[]) => {
      setIsProcessing(true);
      setError(null);
      try {
        for (const driveFile of driveFiles) {
          const res = await fetch(`${apiBaseUrl()}/api/drive/files/${driveFile.id}/content`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error || `Failed to fetch ${driveFile.name}`);
          }
          const blob = await res.blob();
          const contentDisposition = res.headers.get('Content-Disposition') ?? '';
          const match = contentDisposition.match(/filename="([^"]+)"/);
          const filename = match ? decodeURIComponent(match[1]) : driveFile.name;
          const file = new File([blob], filename, { type: blob.type || driveFile.mimeType });
          await handleFiles([file]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to attach Drive file');
      } finally {
        setIsProcessing(false);
      }
    },
    [handleFiles, token],
  );

  return { handleDriveFiles, isProcessing, error };
}
