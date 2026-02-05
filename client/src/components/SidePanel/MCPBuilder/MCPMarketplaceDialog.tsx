import { useState, useMemo } from 'react';
import {
  Search,
  Star,
  TrendingUp,
  X,
  ExternalLink,
  Check,
  Download,
  ChevronLeft,
  Code2,
  Briefcase,
  BarChart3,
  Zap,
  Bot,
  MessageSquare,
  FolderOpen,
  Database,
  Plug,
  Package,
  Store,
} from 'lucide-react';
import { Button, Input, Dialog, DialogContent, DialogTitle } from '@librechat/client';
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

// Icon mapping for categories
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Search: Search,
  Briefcase: Briefcase,
  Code2: Code2,
  BarChart3: BarChart3,
  Zap: Zap,
  Bot: Bot,
  MessageSquare: MessageSquare,
  FolderOpen: FolderOpen,
  Database: Database,
  Plug: Plug,
  Package: Package,
};

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
    setSearchQuery('');
    setSelectedCategory('featured');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-7xl h-[90vh] p-0 overflow-hidden"
        showCloseButton={true}
      >
        <div className="flex h-full">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3 mb-4">
                <Store className="size-7 text-blue-600 dark:text-blue-400" />
                <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  MCP Marketplace
                </DialogTitle>
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-bold text-green-700 dark:text-green-300">
                  {mcpMarketplace.length} MCPs
                </span>
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
                {mcpCategories.map((cat) => {
                  const IconComponent = categoryIcons[cat.iconName];
                  return (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="gap-2"
                    >
                      {IconComponent && <IconComponent className="size-4" />}
                      {cat.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* MCP Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
              {filteredMCPs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-4">
                    <Search className="size-16 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">No MCPs found</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className={cn(
                  'grid gap-5',
                  selectedMCP 
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' 
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                )}>
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
  const categoryInfo = mcpCategories.find(c => c.id === mcp.category);
  const CategoryIcon = categoryInfo ? categoryIcons[categoryInfo.iconName] : Package;

  const getPricingBadge = () => {
    switch (mcp.pricing) {
      case 'free':
        return <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">FREE</span>;
      case 'paid':
        return <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">PAID</span>;
      case 'freemium':
        return <span className="inline-flex items-center rounded-full bg-purple-600 px-2 py-0.5 text-xs font-semibold text-white">FREEMIUM</span>;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col p-5 rounded-xl border-2 transition-all text-left',
        'hover:shadow-xl hover:scale-[1.02]',
        isSelected
          ? 'border-blue-500 shadow-lg bg-white dark:bg-gray-800 ring-2 ring-blue-500/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {mcp.icon ? (
          <div className="size-14 rounded-lg bg-white dark:bg-gray-700 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-600 flex-shrink-0 shadow-sm">
            <img 
              src={mcp.icon} 
              alt={mcp.displayName} 
              className="size-full object-contain"
              loading="lazy"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && CategoryIcon) {
                  parent.innerHTML = '';
                  parent.className = 'size-14 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-3 flex items-center justify-center flex-shrink-0 shadow-sm';
                }
              }}
            />
          </div>
        ) : (
          <div className="size-14 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-3 flex items-center justify-center flex-shrink-0 shadow-sm">
            {CategoryIcon && <CategoryIcon className="size-full text-white" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
              {mcp.displayName}
            </h3>
            {mcp.verified && (
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-0.5">
                <Check className="size-4 text-green-600 dark:text-green-400 shrink-0" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {getPricingBadge()}
            {mcp.featured && (
              <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-0.5 rounded">
                <Star className="size-3 text-yellow-600 dark:text-yellow-400 fill-current" />
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Featured</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3 flex-1 leading-relaxed">
        {mcp.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
          {mcp.toolCount && (
            <span className="font-semibold">{mcp.toolCount} tools</span>
          )}
          {mcp.rating && (
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-gray-900 dark:text-gray-100">{mcp.rating}</span>
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px] font-medium">
          {mcp.author}
        </span>
      </div>

      {/* Hover indicator */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-b-xl transition-opacity",
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
  const categoryInfo = mcpCategories.find(c => c.id === mcp.category);
  const CategoryIcon = categoryInfo ? categoryIcons[categoryInfo.iconName] : Package;

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
    <div className="w-[480px] border-l-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto flex-shrink-0">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 p-6 z-10 space-y-4 shadow-sm">
        {/* Back button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack} 
          className="gap-2 -ml-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ChevronLeft className="size-4" />
          Back to list
        </Button>

        {/* MCP Header */}
        <div className="flex items-start gap-4">
          {mcp.icon ? (
            <div className="size-20 rounded-xl bg-white dark:bg-gray-700 p-3 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600 flex-shrink-0 shadow-md">
              <img 
                src={mcp.icon} 
                alt={mcp.displayName} 
                className="size-full object-contain"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && CategoryIcon) {
                    parent.innerHTML = '';
                    parent.className = 'size-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-4 flex items-center justify-center flex-shrink-0 shadow-md';
                  }
                }}
              />
            </div>
          ) : (
            <div className="size-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-4 flex items-center justify-center flex-shrink-0 shadow-md">
              {CategoryIcon && <CategoryIcon className="size-full text-white" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">{mcp.displayName}</h2>
              {mcp.verified && (
                <div className="bg-green-100 dark:bg-green-900/40 rounded-full p-1">
                  <Check className="size-5 text-green-600 dark:text-green-400" />
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{mcp.author}</p>
          </div>
        </div>

        {/* Install Button */}
        <Button
          onClick={handleInstall}
          disabled={installing}
          className="w-full gap-2 h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
          size="lg"
        >
          <Download className="size-5" />
          {installing ? 'Installing...' : 'Install MCP'}
        </Button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 bg-white dark:bg-gray-800">
        {/* Pricing */}
        <div>
          <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">Pricing</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span 
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold",
                mcp.pricing === 'free' 
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                  : mcp.pricing === 'paid' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-purple-600 text-white'
              )}
            >
              {mcp.pricing.toUpperCase()}
            </span>
            {mcp.priceDetails && (
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{mcp.priceDetails}</span>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">About</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {mcp.longDescription || mcp.description}
          </p>
        </div>

        {/* Stats */}
        {(mcp.rating || mcp.toolCount || mcp.reviews) && (
          <div>
            <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">Stats</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              {mcp.rating && (
                <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 px-3 py-2 rounded-lg">
                  <Star className="size-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-gray-900 dark:text-gray-100">{mcp.rating} / 5.0</span>
                </div>
              )}
              {mcp.reviews && (
                <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{mcp.reviews} reviews</span>
                </div>
              )}
              {mcp.toolCount && (
                <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{mcp.toolCount} tools</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools */}
        {mcp.tools && mcp.tools.length > 0 && (
          <div>
            <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">Available Tools</h3>
            <div className="flex flex-wrap gap-2">
              {mcp.tools.map((tool) => (
                <span 
                  key={tool} 
                  className="inline-flex items-center rounded-md border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2.5 py-1 text-xs font-mono font-semibold text-gray-800 dark:text-gray-200"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Environment Variables */}
        {mcp.envVarsRequired && mcp.envVarsRequired.length > 0 && (
          <div>
            <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">Required Configuration</h3>
            <div className="space-y-3">
              {mcp.envVarsRequired.map((env) => (
                <div key={env.name} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">{env.name}</code>
                    {env.required && (
                      <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300">Required</span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{env.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Installation */}
        {mcp.quickInstall && (
          <div>
            <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">Quick Install</h3>
            <div className="p-4 bg-gray-900 dark:bg-gray-950 rounded-lg border-2 border-gray-700">
              <code className="text-sm font-mono break-all text-green-400">
                {mcp.quickInstall.command} {mcp.quickInstall.args?.join(' ')}
              </code>
            </div>
          </div>
        )}

        {/* Links */}
        <div>
          <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">Links</h3>
          <div className="space-y-3">
            {mcp.homepage && (
              <a
                href={mcp.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
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
                className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
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
                className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
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
            <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-gray-100">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {mcp.tags.map((tag) => (
                <span 
                  key={tag} 
                  className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
