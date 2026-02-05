import { useState, useMemo } from 'react';
import { Search, Star, TrendingUp, Filter, ExternalLink, Check, Download } from 'lucide-react';
import { Button, Input, Badge } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import {
  mcpMarketplace,
  mcpCategories,
  getFeaturedMCPs,
  getFreeMCPs,
  searchMCPs,
  type MCPMarketplaceItem,
  type MCPCategory,
} from '~/data/mcpMarketplace';

export default function MCPMarketplace() {
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

  return (
    <div className="flex h-full w-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Search */}
        <div className="p-4 border-b border-border-medium">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold">MCP Marketplace</h2>
            <Badge variant="success" className="text-xs">
              {mcpMarketplace.length} MCPs Available
            </Badge>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-secondary" />
            <Input
              type="text"
              placeholder="Search MCPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-4 py-3 border-b border-border-medium overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <Button
              size="sm"
              variant={selectedCategory === 'featured' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('featured')}
              className="gap-1.5"
            >
              <Star className="size-3.5" />
              Featured
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'free' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('free')}
              className="gap-1.5"
            >
              <TrendingUp className="size-3.5" />
              Free
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </Button>
            <div className="w-px bg-border-medium mx-1" />
            {mcpCategories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.id)}
                className="gap-1.5"
              >
                <span>{cat.icon}</span>
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* MCP Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredMCPs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
              <Filter className="size-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No MCPs found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMCPs.map((mcp) => (
                <MCPCard
                  key={mcp.id}
                  mcp={mcp}
                  onClick={() => setSelectedMCP(mcp)}
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
        />
      )}
    </div>
  );
}

interface MCPCardProps {
  mcp: MCPMarketplaceItem;
  onClick: () => void;
}

function MCPCard({ mcp, onClick }: MCPCardProps) {
  const getPricingBadge = () => {
    switch (mcp.pricing) {
      case 'free':
        return <Badge variant="success" className="text-xs">Free</Badge>;
      case 'paid':
        return <Badge variant="default" className="text-xs">Paid</Badge>;
      case 'freemium':
        return <Badge variant="info" className="text-xs">Freemium</Badge>;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col p-4 rounded-lg border border-border-medium',
        'hover:border-border-heavy hover:shadow-md transition-all text-left',
        'bg-surface-primary'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {mcp.icon ? (
          <img src={mcp.icon} alt="" className="size-10 rounded" />
        ) : (
          <div className="size-10 rounded bg-surface-secondary flex items-center justify-center text-xl">
            {mcpCategories.find(c => c.id === mcp.category)?.icon || '📦'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{mcp.displayName}</h3>
            {mcp.verified && (
              <Check className="size-4 text-green-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {getPricingBadge()}
            {mcp.featured && (
              <Star className="size-3 text-yellow-500 fill-yellow-500" />
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-text-secondary mb-3 line-clamp-2 flex-1">
        {mcp.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-3">
          {mcp.toolCount && (
            <span>{mcp.toolCount} tools</span>
          )}
          {mcp.rating && (
            <span className="flex items-center gap-1">
              <Star className="size-3 text-yellow-500 fill-yellow-500" />
              {mcp.rating}
            </span>
          )}
        </div>
        <span className="text-xs text-text-tertiary">{mcp.author}</span>
      </div>

      {/* Hover indicator */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg" />
    </button>
  );
}

interface MCPDetailPanelProps {
  mcp: MCPMarketplaceItem;
  onClose: () => void;
}

function MCPDetailPanel({ mcp, onClose }: MCPDetailPanelProps) {
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
    <div className="w-96 border-l border-border-medium bg-surface-primary overflow-y-auto">
      <div className="sticky top-0 bg-surface-primary border-b border-border-medium p-4 z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {mcp.icon ? (
              <img src={mcp.icon} alt="" className="size-12 rounded" />
            ) : (
              <div className="size-12 rounded bg-surface-secondary flex items-center justify-center text-2xl">
                {mcpCategories.find(c => c.id === mcp.category)?.icon || '📦'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">{mcp.displayName}</h2>
                {mcp.verified && (
                  <Check className="size-5 text-green-500" />
                )}
              </div>
              <p className="text-xs text-text-secondary">{mcp.author}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>×</Button>
        </div>

        <Button
          onClick={handleInstall}
          disabled={installing}
          className="w-full gap-2"
        >
          <Download className="size-4" />
          {installing ? 'Installing...' : 'Install MCP'}
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Pricing */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Pricing</h3>
          <div className="flex items-center gap-2">
            <Badge variant={mcp.pricing === 'free' ? 'success' : mcp.pricing === 'paid' ? 'default' : 'info'}>
              {mcp.pricing}
            </Badge>
            {mcp.priceDetails && (
              <span className="text-xs text-text-secondary">{mcp.priceDetails}</span>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-semibold text-sm mb-2">About</h3>
          <p className="text-sm text-text-secondary">
            {mcp.longDescription || mcp.description}
          </p>
        </div>

        {/* Stats */}
        {(mcp.rating || mcp.toolCount || mcp.reviews) && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Stats</h3>
            <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
              {mcp.rating && (
                <div className="flex items-center gap-1">
                  <Star className="size-4 text-yellow-500 fill-yellow-500" />
                  {mcp.rating} / 5.0
                </div>
              )}
              {mcp.reviews && (
                <span>{mcp.reviews} reviews</span>
              )}
              {mcp.toolCount && (
                <span>{mcp.toolCount} tools</span>
              )}
            </div>
          </div>
        )}

        {/* Tools */}
        {mcp.tools && mcp.tools.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Available Tools</h3>
            <div className="flex flex-wrap gap-2">
              {mcp.tools.map((tool) => (
                <Badge key={tool} variant="outline" className="text-xs">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Environment Variables */}
        {mcp.envVarsRequired && mcp.envVarsRequired.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Required Configuration</h3>
            <div className="space-y-2">
              {mcp.envVarsRequired.map((env) => (
                <div key={env.name} className="p-2 bg-surface-secondary rounded text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="font-mono font-semibold">{env.name}</code>
                    {env.required && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <p className="text-text-secondary">{env.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Installation */}
        {mcp.quickInstall && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Quick Install</h3>
            <div className="p-3 bg-surface-tertiary rounded border border-border-medium">
              <code className="text-xs font-mono">
                {mcp.quickInstall.command} {mcp.quickInstall.args?.join(' ')}
              </code>
            </div>
          </div>
        )}

        {/* Links */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Links</h3>
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
                GitHub
              </a>
            )}
          </div>
        </div>

        {/* Tags */}
        {mcp.tags && mcp.tags.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Tags</h3>
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
