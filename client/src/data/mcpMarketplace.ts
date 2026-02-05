/**
 * MCP Marketplace Data
 * Curated list of free and paid MCP servers with categories and integration info
 */

export interface MCPMarketplaceItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription?: string;
  category: MCPCategory;
  pricing: 'free' | 'paid' | 'freemium';
  priceDetails?: string;
  icon?: string;
  author: string;
  homepage?: string;
  documentation?: string;
  githubRepo?: string;
  featured?: boolean;
  verified?: boolean;
  
  // Installation info
  transport: 'stdio' | 'sse' | 'http';
  installCommand?: string;
  envVarsRequired?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  
  // Quick install config
  quickInstall?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  
  // Stats
  downloads?: number;
  rating?: number;
  reviews?: number;
  
  // Tool capabilities
  tools?: string[];
  toolCount?: number;
  
  // Tags for filtering
  tags: string[];
}

export type MCPCategory = 
  | 'search' 
  | 'productivity' 
  | 'development' 
  | 'data' 
  | 'automation'
  | 'ai' 
  | 'communication'
  | 'file-management'
  | 'database'
  | 'api'
  | 'other';

export const mcpCategories: Array<{ id: MCPCategory; label: string; icon: string }> = [
  { id: 'search', label: 'Web Search', icon: '🔍' },
  { id: 'productivity', label: 'Productivity', icon: '📋' },
  { id: 'development', label: 'Development', icon: '💻' },
  { id: 'data', label: 'Data & Analytics', icon: '📊' },
  { id: 'automation', label: 'Automation', icon: '⚡' },
  { id: 'ai', label: 'AI & ML', icon: '🤖' },
  { id: 'communication', label: 'Communication', icon: '💬' },
  { id: 'file-management', label: 'File Management', icon: '📁' },
  { id: 'database', label: 'Database', icon: '🗄️' },
  { id: 'api', label: 'API Integration', icon: '🔌' },
  { id: 'other', label: 'Other', icon: '📦' },
];

/**
 * Curated MCP Marketplace
 */
export const mcpMarketplace: MCPMarketplaceItem[] = [
  // ===== SEARCH & WEB =====
  {
    id: 'tavily-search',
    name: 'tavily',
    displayName: 'Tavily Search',
    description: 'AI-optimized web search with answer engine capabilities',
    longDescription: 'Tavily provides intelligent web search specifically designed for AI agents. Get accurate, real-time information with source citations and relevance ranking.',
    category: 'search',
    pricing: 'freemium',
    priceDetails: 'Free: 1000 searches/month, Paid: $0.001/search',
    icon: 'https://tavily.com/favicon.ico',
    author: 'Tavily',
    homepage: 'https://tavily.com',
    documentation: 'https://docs.tavily.com',
    featured: true,
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'TAVILY_API_KEY',
        description: 'Get from https://app.tavily.com',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-tavily'],
    },
    rating: 4.8,
    reviews: 245,
    toolCount: 2,
    tools: ['search', 'answer'],
    tags: ['search', 'web', 'ai', 'research', 'verified'],
  },
  
  {
    id: 'brave-search',
    name: 'brave-search',
    displayName: 'Brave Search',
    description: 'Privacy-focused search engine with web, local, and news results',
    longDescription: 'Access Brave\'s independent search index with privacy-first approach. Includes web search, local search, and news aggregation.',
    category: 'search',
    pricing: 'freemium',
    priceDetails: 'Free tier available, Pro: $3/month',
    icon: 'https://brave.com/favicon.ico',
    author: 'Brave Software',
    homepage: 'https://brave.com/search/api/',
    documentation: 'https://brave.com/search/api/docs',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'BRAVE_API_KEY',
        description: 'Get from https://brave.com/search/api/',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
    },
    rating: 4.6,
    reviews: 189,
    toolCount: 3,
    tools: ['web_search', 'local_search', 'news_search'],
    tags: ['search', 'privacy', 'news', 'verified'],
  },

  {
    id: 'searxng',
    name: 'searxng',
    displayName: 'SearXNG',
    description: 'Meta-search engine aggregating results from multiple sources',
    longDescription: 'Free, open-source meta-search engine that respects privacy. Aggregate results from 70+ search engines without tracking.',
    category: 'search',
    pricing: 'free',
    icon: 'https://docs.searxng.org/favicon.ico',
    author: 'SearXNG Community',
    homepage: 'https://searxng.org',
    githubRepo: 'https://github.com/searxng/searxng',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'SEARXNG_BASE_URL',
        description: 'Your SearXNG instance URL (e.g., https://searx.be)',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-searxng'],
    },
    rating: 4.5,
    reviews: 156,
    toolCount: 1,
    tools: ['search'],
    tags: ['search', 'privacy', 'open-source', 'free', 'verified'],
  },

  // ===== PRODUCTIVITY =====
  {
    id: 'google-workspace',
    name: 'google-workspace',
    displayName: 'Google Workspace',
    description: 'Access Gmail, Google Drive, Calendar, and Docs',
    longDescription: 'Full integration with Google Workspace suite. Read/write emails, manage calendar events, access Drive files, and collaborate on Docs.',
    category: 'productivity',
    pricing: 'free',
    icon: 'https://www.google.com/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://workspace.google.com',
    documentation: 'https://modelcontextprotocol.io/docs/integrations/google',
    featured: true,
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'GOOGLE_CLIENT_ID',
        description: 'OAuth client ID from Google Cloud Console',
        required: true,
      },
      {
        name: 'GOOGLE_CLIENT_SECRET',
        description: 'OAuth client secret',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-workspace'],
    },
    rating: 4.7,
    reviews: 312,
    toolCount: 15,
    tools: ['gmail_search', 'gmail_send', 'drive_list', 'calendar_events', 'docs_create'],
    tags: ['productivity', 'email', 'calendar', 'drive', 'docs', 'verified'],
  },

  {
    id: 'notion',
    name: 'notion',
    displayName: 'Notion',
    description: 'Read and write Notion pages, databases, and blocks',
    longDescription: 'Complete Notion integration for managing workspaces, creating pages, querying databases, and collaborating with your team.',
    category: 'productivity',
    pricing: 'free',
    icon: 'https://notion.so/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://notion.so',
    documentation: 'https://developers.notion.com',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'NOTION_API_KEY',
        description: 'Internal integration token from https://notion.so/my-integrations',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-notion'],
    },
    rating: 4.8,
    reviews: 267,
    toolCount: 12,
    tools: ['search_pages', 'create_page', 'update_page', 'query_database', 'create_database'],
    tags: ['productivity', 'notes', 'database', 'collaboration', 'verified'],
  },

  {
    id: 'slack',
    name: 'slack',
    displayName: 'Slack',
    description: 'Send messages, read channels, and manage workspaces',
    longDescription: 'Full Slack integration for team communication. Send DMs, post to channels, search messages, manage users, and automate workflows.',
    category: 'communication',
    pricing: 'free',
    icon: 'https://slack.com/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://slack.com',
    documentation: 'https://api.slack.com',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'SLACK_BOT_TOKEN',
        description: 'Bot token from https://api.slack.com/apps',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
    },
    rating: 4.6,
    reviews: 198,
    toolCount: 10,
    tools: ['send_message', 'list_channels', 'search_messages', 'create_channel', 'invite_user'],
    tags: ['communication', 'collaboration', 'messaging', 'verified'],
  },

  // ===== DEVELOPMENT =====
  {
    id: 'github',
    name: 'github',
    displayName: 'GitHub',
    description: 'Manage repositories, issues, PRs, and code search',
    longDescription: 'Complete GitHub integration. Create/update issues, manage pull requests, search code, create gists, and automate workflows.',
    category: 'development',
    pricing: 'free',
    icon: 'https://github.com/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://github.com',
    documentation: 'https://docs.github.com/rest',
    featured: true,
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        description: 'Create at https://github.com/settings/tokens',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
    },
    rating: 4.9,
    reviews: 456,
    toolCount: 20,
    tools: ['create_issue', 'search_code', 'create_pr', 'list_repos', 'create_gist'],
    tags: ['development', 'git', 'code', 'collaboration', 'verified'],
  },

  {
    id: 'gitlab',
    name: 'gitlab',
    displayName: 'GitLab',
    description: 'GitLab project management, CI/CD, and code review',
    longDescription: 'Full GitLab integration for DevOps workflows. Manage projects, issues, merge requests, pipelines, and more.',
    category: 'development',
    pricing: 'free',
    icon: 'https://gitlab.com/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://gitlab.com',
    documentation: 'https://docs.gitlab.com/api/',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'GITLAB_PERSONAL_ACCESS_TOKEN',
        description: 'Create at Settings > Access Tokens',
        required: true,
      },
      {
        name: 'GITLAB_URL',
        description: 'GitLab instance URL (default: https://gitlab.com)',
        required: false,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gitlab'],
    },
    rating: 4.7,
    reviews: 178,
    toolCount: 18,
    tools: ['create_issue', 'create_mr', 'list_pipelines', 'search_projects', 'create_branch'],
    tags: ['development', 'git', 'devops', 'ci-cd', 'verified'],
  },

  {
    id: 'docker',
    name: 'docker',
    displayName: 'Docker',
    description: 'Manage containers, images, and Docker Compose',
    longDescription: 'Control Docker from your AI agent. List/start/stop containers, build images, manage volumes, and orchestrate with Docker Compose.',
    category: 'development',
    pricing: 'free',
    icon: 'https://docker.com/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://docker.com',
    documentation: 'https://docs.docker.com/engine/api/',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-docker'],
    },
    rating: 4.5,
    reviews: 134,
    toolCount: 14,
    tools: ['list_containers', 'start_container', 'build_image', 'docker_compose_up', 'logs'],
    tags: ['development', 'devops', 'containers', 'infrastructure', 'verified'],
  },

  // ===== DATABASE =====
  {
    id: 'postgres',
    name: 'postgresql',
    displayName: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    longDescription: 'Full PostgreSQL integration. Execute queries, manage tables, analyze data, and perform database operations.',
    category: 'database',
    pricing: 'free',
    icon: 'https://postgresql.org/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://postgresql.org',
    documentation: 'https://modelcontextprotocol.io/docs/integrations/postgres',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'POSTGRES_CONNECTION_STRING',
        description: 'PostgreSQL connection URL',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
    },
    rating: 4.8,
    reviews: 223,
    toolCount: 8,
    tools: ['query', 'list_tables', 'describe_table', 'create_table', 'insert', 'update'],
    tags: ['database', 'sql', 'data', 'analytics', 'verified'],
  },

  {
    id: 'sqlite',
    name: 'sqlite',
    displayName: 'SQLite',
    description: 'Query SQLite databases with read/write operations',
    longDescription: 'Lightweight SQLite integration for local databases. Perfect for data analysis, testing, and embedded applications.',
    category: 'database',
    pricing: 'free',
    icon: 'https://sqlite.org/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://sqlite.org',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'SQLITE_DATABASE_PATH',
        description: 'Path to SQLite database file',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
    },
    rating: 4.6,
    reviews: 145,
    toolCount: 6,
    tools: ['query', 'list_tables', 'describe_table', 'create_table', 'insert'],
    tags: ['database', 'sql', 'local', 'embedded', 'verified'],
  },

  // ===== FILE MANAGEMENT =====
  {
    id: 'filesystem',
    name: 'filesystem',
    displayName: 'File System',
    description: 'Read, write, and manage local files and directories',
    longDescription: 'Safe file system access for your AI agent. Read/write files, list directories, move/copy files with permission controls.',
    category: 'file-management',
    pricing: 'free',
    author: 'ModelContext Protocol',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'ALLOWED_DIRECTORIES',
        description: 'Comma-separated list of allowed directory paths',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    },
    rating: 4.7,
    reviews: 289,
    toolCount: 12,
    tools: ['read_file', 'write_file', 'list_directory', 'create_directory', 'move_file', 'delete_file'],
    tags: ['file-management', 'local', 'storage', 'verified'],
  },

  {
    id: 'google-drive',
    name: 'google-drive',
    displayName: 'Google Drive',
    description: 'Upload, download, and manage Google Drive files',
    longDescription: 'Complete Google Drive integration. Upload files, create folders, share documents, search content, and manage permissions.',
    category: 'file-management',
    pricing: 'free',
    icon: 'https://drive.google.com/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://drive.google.com',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'GOOGLE_CLIENT_ID',
        description: 'OAuth client ID',
        required: true,
      },
      {
        name: 'GOOGLE_CLIENT_SECRET',
        description: 'OAuth client secret',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-drive'],
    },
    rating: 4.8,
    reviews: 234,
    toolCount: 10,
    tools: ['upload_file', 'download_file', 'list_files', 'create_folder', 'share_file', 'search'],
    tags: ['file-management', 'cloud', 'storage', 'google', 'verified'],
  },

  // ===== AUTOMATION =====
  {
    id: 'zapier',
    name: 'zapier',
    displayName: 'Zapier',
    description: 'Trigger Zapier automations and workflows',
    longDescription: 'Connect to 5000+ apps via Zapier. Trigger zaps, catch webhooks, and automate workflows from your AI agent.',
    category: 'automation',
    pricing: 'freemium',
    priceDetails: 'Zapier subscription required',
    icon: 'https://zapier.com/favicon.ico',
    author: 'Zapier',
    homepage: 'https://zapier.com',
    documentation: 'https://zapier.com/developer/documentation',
    featured: true,
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'ZAPIER_NLA_API_KEY',
        description: 'Get from https://actions.zapier.com/credentials/',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-zapier'],
    },
    rating: 4.7,
    reviews: 312,
    toolCount: 3,
    tools: ['trigger_zap', 'list_actions', 'execute_action'],
    tags: ['automation', 'integration', 'workflow', 'no-code', 'verified'],
  },

  // ===== AI & ML =====
  {
    id: 'replicate',
    name: 'replicate',
    displayName: 'Replicate',
    description: 'Run AI models for images, audio, video, and text',
    longDescription: 'Access thousands of AI models on Replicate. Generate images, process audio/video, run LLMs, and more.',
    category: 'ai',
    pricing: 'paid',
    priceDetails: 'Pay per model run, prices vary',
    icon: 'https://replicate.com/favicon.ico',
    author: 'Replicate',
    homepage: 'https://replicate.com',
    documentation: 'https://replicate.com/docs',
    featured: true,
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'REPLICATE_API_TOKEN',
        description: 'Get from https://replicate.com/account/api-tokens',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-replicate'],
    },
    rating: 4.9,
    reviews: 423,
    toolCount: 5,
    tools: ['run_model', 'list_models', 'get_prediction', 'cancel_prediction', 'list_versions'],
    tags: ['ai', 'ml', 'image-generation', 'audio', 'video', 'verified'],
  },

  // ===== DATA & ANALYTICS =====
  {
    id: 'google-sheets',
    name: 'google-sheets',
    displayName: 'Google Sheets',
    description: 'Read and write Google Sheets data',
    longDescription: 'Full Google Sheets integration. Read/write cells, create sheets, format data, and perform calculations.',
    category: 'data',
    pricing: 'free',
    icon: 'https://sheets.google.com/favicon.ico',
    author: 'ModelContext Protocol',
    homepage: 'https://sheets.google.com',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'GOOGLE_CLIENT_ID',
        description: 'OAuth client ID',
        required: true,
      },
      {
        name: 'GOOGLE_CLIENT_SECRET',
        description: 'OAuth client secret',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-sheets'],
    },
    rating: 4.8,
    reviews: 289,
    toolCount: 8,
    tools: ['read_range', 'write_range', 'create_sheet', 'append_row', 'clear_range', 'format_cells'],
    tags: ['data', 'spreadsheet', 'analytics', 'google', 'verified'],
  },

  // ===== API INTEGRATIONS =====
  {
    id: 'http-rest',
    name: 'http-rest',
    displayName: 'HTTP/REST API',
    description: 'Make HTTP requests to any REST API',
    longDescription: 'Universal HTTP client for calling any REST API. Supports all methods, headers, authentication, and response parsing.',
    category: 'api',
    pricing: 'free',
    author: 'ModelContext Protocol',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
    rating: 4.6,
    reviews: 234,
    toolCount: 4,
    tools: ['http_get', 'http_post', 'http_put', 'http_delete'],
    tags: ['api', 'http', 'rest', 'integration', 'verified'],
  },

  // ===== OTHER POPULAR MCPS =====
  {
    id: 'weather',
    name: 'weather',
    displayName: 'Weather',
    description: 'Get current weather and forecasts',
    longDescription: 'Real-time weather data and forecasts. Current conditions, hourly/daily forecasts, alerts, and historical data.',
    category: 'other',
    pricing: 'freemium',
    priceDetails: 'Free tier available',
    author: 'ModelContext Protocol',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'OPENWEATHER_API_KEY',
        description: 'Get from https://openweathermap.org/api',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-weather'],
    },
    rating: 4.5,
    reviews: 167,
    toolCount: 4,
    tools: ['current_weather', 'forecast', 'alerts', 'historical'],
    tags: ['weather', 'data', 'forecast', 'verified'],
  },

  {
    id: 'puppeteer',
    name: 'puppeteer',
    displayName: 'Puppeteer',
    description: 'Browser automation for web scraping and testing',
    longDescription: 'Headless browser automation. Navigate websites, fill forms, take screenshots, extract data, and automate testing.',
    category: 'automation',
    pricing: 'free',
    author: 'ModelContext Protocol',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
    rating: 4.7,
    reviews: 198,
    toolCount: 10,
    tools: ['navigate', 'click', 'type', 'screenshot', 'extract_text', 'fill_form'],
    tags: ['automation', 'scraping', 'testing', 'browser', 'verified'],
  },
];

/**
 * Get MCPs by category
 */
export function getMCPsByCategory(category: MCPCategory): MCPMarketplaceItem[] {
  return mcpMarketplace.filter(mcp => mcp.category === category);
}

/**
 * Get featured MCPs
 */
export function getFeaturedMCPs(): MCPMarketplaceItem[] {
  return mcpMarketplace.filter(mcp => mcp.featured);
}

/**
 * Get free MCPs
 */
export function getFreeMCPs(): MCPMarketplaceItem[] {
  return mcpMarketplace.filter(mcp => mcp.pricing === 'free');
}

/**
 * Search MCPs
 */
export function searchMCPs(query: string): MCPMarketplaceItem[] {
  const lowerQuery = query.toLowerCase();
  return mcpMarketplace.filter(mcp => 
    mcp.displayName.toLowerCase().includes(lowerQuery) ||
    mcp.description.toLowerCase().includes(lowerQuery) ||
    mcp.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
