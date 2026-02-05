import { useState, useMemo } from 'react';
import { Search, Star, TrendingUp, X, ExternalLink, Check, Download, ChevronLeft } from 'lucide-react';
import { Button, Input, Badge, Dialog, DialogContent, DialogTitle } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import {
  mcpMarketplace,
  mcpCategories,
  getFeaturedMCPs,
  getFreeMCPs,
  type MCPMarketplaceItem,
  type MCPCategory,
} from '~/data/mcpMarketplace';

interface MCPMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MCPMarketplaceDialog({ open, onOpenChange }: MCPMarketplaceDialogProps) {
  const localize = useLocalize();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MCPCategory | 'all' | 'featured' | 'free'>('featured');
  const [selectedMCP, setSelectedMCP] = useState<MCPMarketplaceItem | null>(null);

  const filteredMCPs = useMemo(() => {
    let mcps: MCPMarketplaceItem[];

    // Filter by category/special filters
    if (selectedCategory === 'featured') {
      mcps = getFeaturedMCPs();
    } else if (selectedCategory === 'free') {
      mcps = getFreeMCPs();
    } else if (selectedCategory === 'all') {
      mcps = mcpMarketplace;
    } else {
      mcps = mcpMarketplace.filter(mcp => mcp.category === selectedCategory);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      mcps = mcps.filter(mcp =>
        mcp.displayName.toLowerCase().includes(query) ||
        mcp.description.toLowerCase().includes(query) ||
        mcp.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return mcps;
  }, [searchQuery, selectedCategory]);

  const handleClose = () => {
    setSelectedMCP(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-7xl h-[90vh] p-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="flex h-full">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border-medium bg-surface-primary">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-semibold">MCP Marketplace</DialogTitle>
                  <Badge variant="success" className="text-sm">
                    {mcpMarketplace.length} MCPs
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="size-5" />
                </Button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-secondary" />
                <Input
                  type="text"
                  placeholder="Search MCPs by name, description, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 h-11"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="px-6 py-4 border-b border-border-medium overflow-x-auto bg-surface-primary">
              <div className="flex gap-2 min-w-max">
                <Button
                  size="sm"
                  variant={selectedCategory === 'featured' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('featured')}
                  className="gap-2"
                >
                  <Star className="size-4" />
                  Featured
                </Button>
                <Button
                  size="sm"
                  variant={selectedCategory === 'free' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('free')}
                  className="gap-2"
                >
                  <TrendingUp className="size-4" />
                  Free
                </Button>
                <Button
                  size="sm"
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </Button>
                <div className="w-px bg-border-medium mx-2" />
                {mcpCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="gap-2"
                  >
                    <span className="text-base">{cat.icon}</span>
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* MCP Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-surface-secondary/30">
              {filteredMCPs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
                  <Search className="size-16 mb-4 opacity-50" />
                  <p className="text-xl font-medium mb-2">No MCPs found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredMCPs.map((mcp) => (
                    <MCPCard
                      key={mcp.id}
                      mcp={mcp}
                      onClick={() => setSelectedMCP(mcp)}
                      isSelected={selectedMCP?.id === mcp.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedMCP && (
            <MCPDetailPanel
              mcp={selectedMCP}
              onClose={() => setSelectedMCP(null)}
              onBack={() => setSelectedMCP(null)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MCPCardProps {
  mcp: MCPMarketplaceItem;
  onClick: () => void;
  isSelected: boolean;
}

function MCPCard({ mcp, onClick, isSelected }: MCPCardProps) {
  const getPricingBadge = () => {
    switch (mcp.pricing) {
      case 'free':
        return <Badge variant="success" className="text-xs font-medium">Free</Badge>;
      case 'paid':
        return <Badge variant="default" className="text-xs font-medium">Paid</Badge>;
      case 'freemium':
        return <Badge variant="info" className="text-xs font-medium">Freemium</Badge>;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col p-5 rounded-lg border transition-all text-left',
        'hover:shadow-lg',
        isSelected
          ? 'border-blue-500 shadow-md bg-surface-primary ring-2 ring-blue-500/20'
          : 'border-border-medium hover:border-border-heavy bg-surface-primary'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {mcp.icon ? (
          <img src={mcp.icon} alt="" className="size-12 rounded flex-shrink-0" />
        ) : (
          <div className="size-12 rounded bg-surface-secondary flex items-center justify-center text-2xl flex-shrink-0">
            {mcpCategories.find(c => c.id === mcp.category)?.icon || '📦'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-semibold text-base truncate">{mcp.displayName}</h3>
            {mcp.verified && (
              <Check className="size-4 text-green-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {getPricingBadge()}
            {mcp.featured && (
              <Star className="size-3.5 text-yellow-500 fill-yellow-500" />
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary mb-4 line-clamp-3 flex-1 leading-relaxed">
        {mcp.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-text-secondary pt-3 border-t border-border-light">
        <div className="flex items-center gap-3">
          {mcp.toolCount && (
            <span className="font-medium">{mcp.toolCount} tools</span>
          )}
          {mcp.rating && (
            <span className="flex items-center gap-1">
              <Star className="size-3 text-yellow-500 fill-yellow-500" />
              <span className="font-medium">{mcp.rating}</span>
            </span>
          )}
        </div>
        <span className="text-xs text-text-tertiary truncate max-w-[120px]">{mcp.author}</span>
      </div>

      {/* Hover indicator */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-b-lg transition-opacity",
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )} />
    </button>
  );
}

interface MCPDetailPanelProps {
  mcp: MCPMarketplaceItem;
  onClose: () => void;
  onBack: () => void;
}

function MCPDetailPanel({ mcp, onClose, onBack }: MCPDetailPanelProps) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    // TODO: Implement actual installation logic
    // This would call your backend API to add the MCP server
    setTimeout(() => {
      alert(`Installation guide:\n\n1. Copy the command below\n2. Add MCP server in Settings\n3. Paste configuration\n\nCommand: ${mcp.quickInstall?.command} ${mcp.quickInstall?.args?.join(' ')}`);
      setInstalling(false);
    }, 1000);
  };

  return (
    <div className="w-[480px] border-l border-border-medium bg-surface-primary overflow-y-auto flex-shrink-0">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-surface-primary border-b border-border-medium p-6 z-10 space-y-4">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 -ml-2">
          <ChevronLeft className="size-4" />
          Back to list
        </Button>

        {/* MCP Header */}
        <div className="flex items-start gap-4">
          {mcp.icon ? (
            <img src={mcp.icon} alt="" className="size-16 rounded" />
          ) : (
            <div className="size-16 rounded bg-surface-secondary flex items-center justify-center text-3xl">
              {mcpCategories.find(c => c.id === mcp.category)?.icon || '📦'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-semibold text-xl">{mcp.displayName}</h2>
              {mcp.verified && (
                <Check className="size-5 text-green-500" />
              )}
            </div>
            <p className="text-sm text-text-secondary">{mcp.author}</p>
          </div>
        </div>

        {/* Install Button */}
        <Button
          onClick={handleInstall}
          disabled={installing}
          className="w-full gap-2 h-11"
          size="lg"
        >
          <Download className="size-4" />
          {installing ? 'Installing...' : 'Install MCP'}
        </Button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Pricing */}
        <div>
          <h3 className="font-semibold text-base mb-3">Pricing</h3>
          <div className="flex items-center gap-3">
            <Badge variant={mcp.pricing === 'free' ? 'success' : mcp.pricing === 'paid' ? 'default' : 'info'} className="text-sm">
              {mcp.pricing.toUpperCase()}
            </Badge>
            {mcp.priceDetails && (
              <span className="text-sm text-text-secondary">{mcp.priceDetails}</span>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-semibold text-base mb-3">About</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {mcp.longDescription || mcp.description}
          </p>
        </div>

        {/* Stats */}
        {(mcp.rating || mcp.toolCount || mcp.reviews) && (
          <div>
            <h3 className="font-semibold text-base mb-3">Stats</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              {mcp.rating && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Star className="size-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-medium">{mcp.rating} / 5.0</span>
                </div>
              )}
              {mcp.reviews && (
                <span className="text-text-secondary">{mcp.reviews} reviews</span>
              )}
              {mcp.toolCount && (
                <span className="text-text-secondary font-medium">{mcp.toolCount} tools</span>
              )}
            </div>
          </div>
        )}

        {/* Tools */}
        {mcp.tools && mcp.tools.length > 0 && (
          <div>
            <h3 className="font-semibold text-base mb-3">Available Tools</h3>
            <div className="flex flex-wrap gap-2">
              {mcp.tools.map((tool) => (
                <Badge key={tool} variant="outline" className="text-xs font-mono">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Environment Variables */}
        {mcp.envVarsRequired && mcp.envVarsRequired.length > 0 && (
          <div>
            <h3 className="font-semibold text-base mb-3">Required Configuration</h3>
            <div className="space-y-3">
              {mcp.envVarsRequired.map((env) => (
                <div key={env.name} className="p-3 bg-surface-secondary rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <code className="font-mono font-semibold text-sm">{env.name}</code>
                    {env.required && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <p className="text-text-secondary text-xs leading-relaxed">{env.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Installation */}
        {mcp.quickInstall && (
          <div>
            <h3 className="font-semibold text-base mb-3">Quick Install</h3>
            <div className="p-4 bg-surface-tertiary rounded-lg border border-border-medium">
              <code className="text-sm font-mono break-all">
                {mcp.quickInstall.command} {mcp.quickInstall.args?.join(' ')}
              </code>
            </div>
          </div>
        )}

        {/* Links */}
        <div>
          <h3 className="font-semibold text-base mb-3">Links</h3>
          <div className="space-y-2">
            {mcp.homepage && (
              <a
                href={mcp.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-text-link hover:underline"
              >
                <ExternalLink className="size-4" />
                Homepage
              </a>
            )}
            {mcp.documentation && (
              <a
                href={mcp.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-text-link hover:underline"
              >
                <ExternalLink className="size-4" />
                Documentation
              </a>
            )}
            {mcp.githubRepo && (
              <a
                href={mcp.githubRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-text-link hover:underline"
              >
                <ExternalLink className="size-4" />
                GitHub Repository
              </a>
            )}
          </div>
        </div>

        {/* Tags */}
        {mcp.tags && mcp.tags.length > 0 && (
          <div>
            <h3 className="font-semibold text-base mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {mcp.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
