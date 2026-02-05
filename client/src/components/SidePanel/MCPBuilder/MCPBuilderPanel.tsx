import { useState, useRef, useMemo } from 'react';
import { Plus, Store } from 'lucide-react';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { Button, Spinner, FilterInput, OGDialogTrigger, TooltipAnchor } from '@librechat/client';
import { useLocalize, useMCPServerManager, useHasAccess } from '~/hooks';
import MCPConfigDialog from '~/components/MCP/MCPConfigDialog';
import MCPAdminSettings from './MCPAdminSettings';
import MCPServerDialog from './MCPServerDialog';
import MCPServerList from './MCPServerList';
import MCPMarketplaceDialog from './MCPMarketplaceDialog';

export default function MCPBuilderPanel() {
  const localize = useLocalize();
  const { availableMCPServers, isLoading, getServerStatusIconProps, getConfigDialogProps } =
    useMCPServerManager();

  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.CREATE,
  });
  const [showDialog, setShowDialog] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const configDialogProps = getConfigDialogProps();

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableMCPServers;
    }
    const query = searchQuery.toLowerCase();
    return availableMCPServers.filter((server) => {
      const displayName = server.config?.title || server.serverName;
      return (
        displayName.toLowerCase().includes(query) || server.serverName.toLowerCase().includes(query)
      );
    });
  }, [availableMCPServers, searchQuery]);

  return (
    <div className="flex h-full w-full flex-col overflow-visible">
      <div role="region" aria-label={localize('com_ui_mcp_servers')} className="mt-2 space-y-2">
        {/* Toolbar: Browse Marketplace + Search + Add Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowMarketplace(true)}
            className="gap-2 shrink-0"
          >
            <Store className="size-4" />
            Browse Marketplace
          </Button>
          <FilterInput
            inputId="mcp-filter"
            label={localize('com_ui_filter_mcp_servers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            containerClassName="flex-1"
          />
          {hasCreateAccess && (
            <MCPServerDialog
              open={showDialog}
              onOpenChange={setShowDialog}
              triggerRef={addButtonRef}
            >
              <OGDialogTrigger asChild>
                <TooltipAnchor
                  description={localize('com_ui_add_mcp')}
                  side="bottom"
                  render={
                    <Button
                      ref={addButtonRef}
                      variant="outline"
                      size="icon"
                      className="shrink-0 bg-transparent"
                      onClick={() => setShowDialog(true)}
                      aria-label={localize('com_ui_add_mcp')}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  }
                />
              </OGDialogTrigger>
            </MCPServerDialog>
          )}
        </div>

        {/* Server Cards List */}
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner className="size-6" aria-label={localize('com_ui_loading')} />
          </div>
        ) : (
          <MCPServerList
            servers={filteredServers}
            getServerStatusIconProps={getServerStatusIconProps}
            isFiltered={searchQuery.trim().length > 0}
          />
        )}

        {/* Config Dialog for custom user vars */}
        {configDialogProps && <MCPConfigDialog {...configDialogProps} />}

        {/* Admin Settings Section */}
        <MCPAdminSettings />
      </div>

      {/* Marketplace Dialog */}
      <MCPMarketplaceDialog open={showMarketplace} onOpenChange={setShowMarketplace} />
    </div>
  );
}
