import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@librechat/client';

interface MCPMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MCPMarketplaceDialog({ open, onOpenChange }: MCPMarketplaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[90vw] max-w-7xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border-medium px-4 py-3">
          <DialogTitle className="text-base font-semibold">MCP Marketplace</DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <iframe
          src="https://mcpmarket.com"
          title="MCP Marketplace"
          className="h-full w-full flex-1 border-0"
          allow="clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </DialogContent>
    </Dialog>
  );
}
