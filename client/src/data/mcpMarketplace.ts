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

export const mcpCategories: Array<{ id: MCPCategory; label: string; iconName: string }> = [
  { id: 'search', label: 'Web Search', iconName: 'Search' },
  { id: 'productivity', label: 'Productivity', iconName: 'Briefcase' },
  { id: 'development', label: 'Development', iconName: 'Code2' },
  { id: 'data', label: 'Data & Analytics', iconName: 'BarChart3' },
  { id: 'automation', label: 'Automation', iconName: 'Zap' },
  { id: 'ai', label: 'AI & ML', iconName: 'Bot' },
  { id: 'communication', label: 'Communication', iconName: 'MessageSquare' },
  { id: 'file-management', label: 'File Management', iconName: 'FolderOpen' },
  { id: 'database', label: 'Database', iconName: 'Database' },
  { id: 'api', label: 'API Integration', iconName: 'Plug' },
  { id: 'other', label: 'Other', iconName: 'Package' },
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

  // ===== DESIGN TOOLS =====
  {
    id: 'figma',
    name: 'figma',
    displayName: 'Figma',
    description: 'Access Figma designs, components, and collaborate',
    longDescription: 'Full Figma integration for designers and developers. Read files, access components, export assets, manage comments, and collaborate on designs.',
    category: 'productivity',
    pricing: 'free',
    icon: 'https://figma.com/favicon.ico',
    author: 'Figma',
    homepage: 'https://figma.com',
    documentation: 'https://figma.com/developers/api',
    featured: true,
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'FIGMA_ACCESS_TOKEN',
        description: 'Personal access token from https://figma.com/developers/api',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-figma'],
    },
    rating: 4.8,
    reviews: 267,
    toolCount: 12,
    tools: ['get_file', 'get_components', 'export_assets', 'post_comment', 'list_projects'],
    tags: ['design', 'ui', 'collaboration', 'assets', 'verified'],
  },

  // ===== PROJECT MANAGEMENT =====
  {
    id: 'linear',
    name: 'linear',
    displayName: 'Linear',
    description: 'Modern issue tracking and project management',
    longDescription: 'Streamline product development with Linear. Create/update issues, manage projects, track cycles, and automate workflows.',
    category: 'productivity',
    pricing: 'freemium',
    priceDetails: 'Free for individuals, Team plans from $8/user/month',
    icon: 'https://linear.app/favicon.ico',
    author: 'Linear',
    homepage: 'https://linear.app',
    documentation: 'https://developers.linear.app',
    featured: true,
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'LINEAR_API_KEY',
        description: 'API key from https://linear.app/settings/api',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-linear'],
    },
    rating: 4.9,
    reviews: 342,
    toolCount: 18,
    tools: ['create_issue', 'update_issue', 'search_issues', 'create_project', 'list_teams'],
    tags: ['productivity', 'project-management', 'issues', 'agile', 'verified'],
  },

  {
    id: 'jira',
    name: 'jira',
    displayName: 'Jira',
    description: 'Enterprise issue tracking and agile project management',
    longDescription: 'Complete Jira integration for enterprise teams. Manage issues, sprints, backlogs, boards, and reports across your organization.',
    category: 'productivity',
    pricing: 'freemium',
    priceDetails: 'Free for 10 users, Standard from $8.15/user/month',
    icon: 'https://jira.atlassian.com/favicon.ico',
    author: 'Atlassian',
    homepage: 'https://atlassian.com/jira',
    documentation: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'JIRA_API_TOKEN',
        description: 'API token from https://id.atlassian.com/manage-profile/security/api-tokens',
        required: true,
      },
      {
        name: 'JIRA_DOMAIN',
        description: 'Your Jira domain (e.g., yourcompany.atlassian.net)',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-jira'],
    },
    rating: 4.5,
    reviews: 412,
    toolCount: 22,
    tools: ['create_issue', 'search_jql', 'transition_issue', 'add_comment', 'create_sprint'],
    tags: ['productivity', 'project-management', 'enterprise', 'agile', 'verified'],
  },

  {
    id: 'airtable',
    name: 'airtable',
    displayName: 'Airtable',
    description: 'Flexible database and spreadsheet hybrid',
    longDescription: 'Powerful no-code database platform. Create bases, manage records, build automations, and organize data your way.',
    category: 'data',
    pricing: 'freemium',
    priceDetails: 'Free tier available, Plus from $10/user/month',
    icon: 'https://airtable.com/favicon.ico',
    author: 'Airtable',
    homepage: 'https://airtable.com',
    documentation: 'https://airtable.com/developers/web/api/introduction',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'AIRTABLE_API_KEY',
        description: 'Personal access token from https://airtable.com/create/tokens',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-airtable'],
    },
    rating: 4.7,
    reviews: 289,
    toolCount: 14,
    tools: ['list_records', 'create_record', 'update_record', 'query_base', 'create_table'],
    tags: ['data', 'database', 'spreadsheet', 'no-code', 'verified'],
  },

  // ===== PAYMENT & FINANCE =====
  {
    id: 'stripe',
    name: 'stripe',
    displayName: 'Stripe',
    description: 'Payment processing and financial infrastructure',
    longDescription: 'Complete payment platform. Process payments, manage subscriptions, handle refunds, view analytics, and build financial products.',
    category: 'api',
    pricing: 'paid',
    priceDetails: '2.9% + $0.30 per transaction',
    icon: 'https://stripe.com/favicon.ico',
    author: 'Stripe',
    homepage: 'https://stripe.com',
    documentation: 'https://stripe.com/docs/api',
    featured: true,
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'STRIPE_API_KEY',
        description: 'Secret key from https://dashboard.stripe.com/apikeys',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-stripe'],
    },
    rating: 4.8,
    reviews: 523,
    toolCount: 25,
    tools: ['create_payment', 'create_subscription', 'refund', 'list_customers', 'get_balance'],
    tags: ['payment', 'finance', 'subscription', 'commerce', 'verified'],
  },

  // ===== COMMUNICATION =====
  {
    id: 'twilio',
    name: 'twilio',
    displayName: 'Twilio',
    description: 'SMS, voice calls, and communication APIs',
    longDescription: 'Programmable communication platform. Send SMS, make calls, video chat, WhatsApp messages, and build communication flows.',
    category: 'communication',
    pricing: 'paid',
    priceDetails: 'Pay as you go, SMS from $0.0075/message',
    icon: 'https://twilio.com/favicon.ico',
    author: 'Twilio',
    homepage: 'https://twilio.com',
    documentation: 'https://twilio.com/docs/api',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'TWILIO_ACCOUNT_SID',
        description: 'Account SID from https://console.twilio.com',
        required: true,
      },
      {
        name: 'TWILIO_AUTH_TOKEN',
        description: 'Auth token from console',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-twilio'],
    },
    rating: 4.7,
    reviews: 378,
    toolCount: 16,
    tools: ['send_sms', 'make_call', 'send_whatsapp', 'list_messages', 'create_room'],
    tags: ['communication', 'sms', 'voice', 'whatsapp', 'verified'],
  },

  {
    id: 'sendgrid',
    name: 'sendgrid',
    displayName: 'SendGrid',
    description: 'Email delivery and marketing automation',
    longDescription: 'Reliable email service. Send transactional emails, manage templates, track analytics, and build email campaigns.',
    category: 'communication',
    pricing: 'freemium',
    priceDetails: 'Free: 100 emails/day, Paid from $19.95/month',
    icon: 'https://sendgrid.com/favicon.ico',
    author: 'SendGrid',
    homepage: 'https://sendgrid.com',
    documentation: 'https://sendgrid.com/docs/api-reference/',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'SENDGRID_API_KEY',
        description: 'API key from https://app.sendgrid.com/settings/api_keys',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sendgrid'],
    },
    rating: 4.6,
    reviews: 234,
    toolCount: 10,
    tools: ['send_email', 'send_template', 'track_stats', 'manage_lists', 'create_template'],
    tags: ['communication', 'email', 'marketing', 'transactional', 'verified'],
  },

  {
    id: 'discord',
    name: 'discord',
    displayName: 'Discord',
    description: 'Community chat and voice communication',
    longDescription: 'Discord bot integration. Send messages, manage servers, moderate channels, create threads, and build community bots.',
    category: 'communication',
    pricing: 'free',
    icon: 'https://discord.com/favicon.ico',
    author: 'Discord',
    homepage: 'https://discord.com',
    documentation: 'https://discord.com/developers/docs',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'DISCORD_BOT_TOKEN',
        description: 'Bot token from https://discord.com/developers/applications',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-discord'],
    },
    rating: 4.8,
    reviews: 312,
    toolCount: 15,
    tools: ['send_message', 'create_channel', 'manage_roles', 'create_thread', 'moderate'],
    tags: ['communication', 'chat', 'community', 'gaming', 'verified'],
  },

  // ===== CLOUD & INFRASTRUCTURE =====
  {
    id: 'aws',
    name: 'aws',
    displayName: 'AWS',
    description: 'Amazon Web Services cloud platform',
    longDescription: 'Comprehensive AWS integration. Manage EC2, S3, Lambda, RDS, DynamoDB, and 200+ AWS services from your AI agent.',
    category: 'development',
    pricing: 'paid',
    priceDetails: 'AWS service pricing applies',
    icon: 'https://aws.amazon.com/favicon.ico',
    author: 'Amazon',
    homepage: 'https://aws.amazon.com',
    documentation: 'https://docs.aws.amazon.com',
    featured: true,
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'AWS_ACCESS_KEY_ID',
        description: 'AWS access key',
        required: true,
      },
      {
        name: 'AWS_SECRET_ACCESS_KEY',
        description: 'AWS secret key',
        required: true,
      },
      {
        name: 'AWS_REGION',
        description: 'AWS region (e.g., us-east-1)',
        required: false,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws'],
    },
    rating: 4.6,
    reviews: 456,
    toolCount: 35,
    tools: ['s3_upload', 'ec2_list', 'lambda_invoke', 'rds_query', 'dynamodb_get'],
    tags: ['cloud', 'infrastructure', 'devops', 'aws', 'verified'],
  },

  {
    id: 'kubernetes',
    name: 'kubernetes',
    displayName: 'Kubernetes',
    description: 'Container orchestration and cluster management',
    longDescription: 'K8s cluster control. Manage deployments, pods, services, ingress, namespaces, and monitor cluster health.',
    category: 'development',
    pricing: 'free',
    icon: 'https://kubernetes.io/favicon.ico',
    author: 'CNCF',
    homepage: 'https://kubernetes.io',
    documentation: 'https://kubernetes.io/docs/reference/',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'KUBECONFIG',
        description: 'Path to kubeconfig file',
        required: false,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-kubernetes'],
    },
    rating: 4.7,
    reviews: 289,
    toolCount: 20,
    tools: ['get_pods', 'deploy', 'scale', 'logs', 'exec', 'port_forward'],
    tags: ['devops', 'containers', 'orchestration', 'cloud-native', 'verified'],
  },

  {
    id: 'terraform',
    name: 'terraform',
    displayName: 'Terraform',
    description: 'Infrastructure as code management',
    longDescription: 'Automate infrastructure with Terraform. Plan, apply, destroy resources, manage state, and build cloud infrastructure.',
    category: 'development',
    pricing: 'free',
    icon: 'https://terraform.io/favicon.ico',
    author: 'HashiCorp',
    homepage: 'https://terraform.io',
    documentation: 'https://terraform.io/docs',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-terraform'],
    },
    rating: 4.8,
    reviews: 267,
    toolCount: 12,
    tools: ['plan', 'apply', 'destroy', 'state_list', 'validate', 'import'],
    tags: ['infrastructure', 'iac', 'devops', 'cloud', 'verified'],
  },

  // ===== MONITORING & ANALYTICS =====
  {
    id: 'sentry',
    name: 'sentry',
    displayName: 'Sentry',
    description: 'Error tracking and application monitoring',
    longDescription: 'Real-time error tracking. Monitor crashes, performance issues, track releases, and debug production problems.',
    category: 'development',
    pricing: 'freemium',
    priceDetails: 'Free: 5K errors/month, Team from $26/month',
    icon: 'https://sentry.io/favicon.ico',
    author: 'Sentry',
    homepage: 'https://sentry.io',
    documentation: 'https://docs.sentry.io/api/',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'SENTRY_AUTH_TOKEN',
        description: 'Auth token from https://sentry.io/settings/account/api/auth-tokens/',
        required: true,
      },
      {
        name: 'SENTRY_ORG',
        description: 'Your Sentry organization slug',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sentry'],
    },
    rating: 4.7,
    reviews: 312,
    toolCount: 14,
    tools: ['list_errors', 'get_issue', 'create_release', 'search_events', 'resolve_issue'],
    tags: ['monitoring', 'errors', 'debugging', 'performance', 'verified'],
  },

  {
    id: 'datadog',
    name: 'datadog',
    displayName: 'Datadog',
    description: 'Infrastructure and application monitoring',
    longDescription: 'Full-stack observability. Monitor metrics, logs, traces, dashboards, alerts, and APM across your infrastructure.',
    category: 'development',
    pricing: 'paid',
    priceDetails: 'From $15/host/month',
    icon: 'https://datadog.com/favicon.ico',
    author: 'Datadog',
    homepage: 'https://datadog.com',
    documentation: 'https://docs.datadoghq.com/api/',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'DATADOG_API_KEY',
        description: 'API key from https://app.datadoghq.com/organization-settings/api-keys',
        required: true,
      },
      {
        name: 'DATADOG_APP_KEY',
        description: 'Application key',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-datadog'],
    },
    rating: 4.6,
    reviews: 267,
    toolCount: 18,
    tools: ['query_metrics', 'create_dashboard', 'list_alerts', 'send_event', 'search_logs'],
    tags: ['monitoring', 'observability', 'metrics', 'logs', 'verified'],
  },

  // ===== DATABASE (Additional) =====
  {
    id: 'mongodb',
    name: 'mongodb',
    displayName: 'MongoDB',
    description: 'NoSQL document database operations',
    longDescription: 'Complete MongoDB integration. Query collections, aggregate data, manage indexes, and perform CRUD operations on NoSQL data.',
    category: 'database',
    pricing: 'freemium',
    priceDetails: 'Free: 512MB, Serverless from $0.10/million reads',
    icon: 'https://mongodb.com/favicon.ico',
    author: 'MongoDB',
    homepage: 'https://mongodb.com',
    documentation: 'https://docs.mongodb.com',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'MONGODB_URI',
        description: 'MongoDB connection string',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-mongodb'],
    },
    rating: 4.8,
    reviews: 345,
    toolCount: 12,
    tools: ['find', 'insert', 'update', 'delete', 'aggregate', 'create_index'],
    tags: ['database', 'nosql', 'document', 'cloud', 'verified'],
  },

  {
    id: 'redis',
    name: 'redis',
    displayName: 'Redis',
    description: 'In-memory data store and cache',
    longDescription: 'Redis key-value store operations. Cache data, pub/sub messaging, session management, and real-time operations.',
    category: 'database',
    pricing: 'freemium',
    priceDetails: 'Free: 30MB, Cloud from $0/month',
    icon: 'https://redis.io/favicon.ico',
    author: 'Redis',
    homepage: 'https://redis.io',
    documentation: 'https://redis.io/commands',
    verified: true,
    transport: 'stdio',
    envVarsRequired: [
      {
        name: 'REDIS_URL',
        description: 'Redis connection URL',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-redis'],
    },
    rating: 4.7,
    reviews: 289,
    toolCount: 15,
    tools: ['get', 'set', 'delete', 'exists', 'expire', 'publish', 'subscribe'],
    tags: ['database', 'cache', 'key-value', 'performance', 'verified'],
  },

  {
    id: 'elasticsearch',
    name: 'elasticsearch',
    displayName: 'Elasticsearch',
    description: 'Search and analytics engine',
    longDescription: 'Powerful search platform. Full-text search, log analytics, complex queries, aggregations, and real-time indexing.',
    category: 'database',
    pricing: 'freemium',
    priceDetails: 'Free tier available, Cloud from $95/month',
    icon: 'https://elastic.co/favicon.ico',
    author: 'Elastic',
    homepage: 'https://elastic.co',
    documentation: 'https://elastic.co/guide/en/elasticsearch/reference/current/',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'ELASTICSEARCH_URL',
        description: 'Elasticsearch cluster URL',
        required: true,
      },
      {
        name: 'ELASTICSEARCH_API_KEY',
        description: 'API key for authentication',
        required: false,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-elasticsearch'],
    },
    rating: 4.6,
    reviews: 234,
    toolCount: 16,
    tools: ['search', 'index', 'bulk', 'aggregate', 'delete_by_query', 'create_index'],
    tags: ['database', 'search', 'analytics', 'logs', 'verified'],
  },

  {
    id: 'snowflake',
    name: 'snowflake',
    displayName: 'Snowflake',
    description: 'Cloud data warehouse and analytics',
    longDescription: 'Enterprise data warehouse. Query massive datasets, run analytics, manage data pipelines, and build data applications.',
    category: 'data',
    pricing: 'paid',
    priceDetails: 'Pay per usage, starts at $2/credit',
    icon: 'https://snowflake.com/favicon.ico',
    author: 'Snowflake',
    homepage: 'https://snowflake.com',
    documentation: 'https://docs.snowflake.com',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'SNOWFLAKE_ACCOUNT',
        description: 'Account identifier',
        required: true,
      },
      {
        name: 'SNOWFLAKE_USER',
        description: 'Username',
        required: true,
      },
      {
        name: 'SNOWFLAKE_PASSWORD',
        description: 'Password',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-snowflake'],
    },
    rating: 4.8,
    reviews: 178,
    toolCount: 10,
    tools: ['query', 'load_data', 'unload_data', 'create_table', 'manage_warehouse'],
    tags: ['data', 'warehouse', 'analytics', 'enterprise', 'verified'],
  },

  // ===== API & INTEGRATION =====
  {
    id: 'graphql',
    name: 'graphql',
    displayName: 'GraphQL',
    description: 'Query any GraphQL API',
    longDescription: 'Universal GraphQL client. Execute queries, mutations, introspect schemas, and interact with any GraphQL endpoint.',
    category: 'api',
    pricing: 'free',
    author: 'ModelContext Protocol',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'GRAPHQL_ENDPOINT',
        description: 'GraphQL API endpoint URL',
        required: true,
      },
      {
        name: 'GRAPHQL_AUTH_TOKEN',
        description: 'Optional authentication token',
        required: false,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-graphql'],
    },
    rating: 4.7,
    reviews: 256,
    toolCount: 6,
    tools: ['query', 'mutate', 'subscribe', 'introspect', 'batch_query'],
    tags: ['api', 'graphql', 'query', 'integration', 'verified'],
  },

  {
    id: 'openapi',
    name: 'openapi',
    displayName: 'OpenAPI',
    description: 'Interact with OpenAPI/Swagger documented APIs',
    longDescription: 'Auto-generate tools from OpenAPI specs. Load swagger docs and automatically create tools for any REST API.',
    category: 'api',
    pricing: 'free',
    author: 'ModelContext Protocol',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'OPENAPI_SPEC_URL',
        description: 'URL to OpenAPI/Swagger specification',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-openapi'],
    },
    rating: 4.8,
    reviews: 223,
    toolCount: 1,
    tools: ['dynamic_api_call'],
    tags: ['api', 'openapi', 'swagger', 'rest', 'verified'],
  },

  // ===== CALENDAR & SCHEDULING =====
  {
    id: 'google-calendar',
    name: 'google-calendar',
    displayName: 'Google Calendar',
    description: 'Manage calendar events and meetings',
    longDescription: 'Full calendar integration. Create events, schedule meetings, set reminders, manage attendees, and sync calendars.',
    category: 'productivity',
    pricing: 'free',
    icon: 'https://calendar.google.com/favicon.ico',
    author: 'Google',
    homepage: 'https://calendar.google.com',
    documentation: 'https://developers.google.com/calendar',
    verified: true,
    transport: 'http',
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
      args: ['-y', '@modelcontextprotocol/server-google-calendar'],
    },
    rating: 4.7,
    reviews: 289,
    toolCount: 12,
    tools: ['create_event', 'list_events', 'update_event', 'delete_event', 'find_time'],
    tags: ['productivity', 'calendar', 'scheduling', 'meetings', 'verified'],
  },

  {
    id: 'calendly',
    name: 'calendly',
    displayName: 'Calendly',
    description: 'Scheduling and meeting coordination',
    longDescription: 'Professional scheduling tool. Create booking links, manage availability, schedule meetings, and automate workflows.',
    category: 'productivity',
    pricing: 'freemium',
    priceDetails: 'Free tier available, Pro from $10/month',
    icon: 'https://calendly.com/favicon.ico',
    author: 'Calendly',
    homepage: 'https://calendly.com',
    documentation: 'https://developer.calendly.com',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'CALENDLY_API_KEY',
        description: 'Personal access token from Calendly',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-calendly'],
    },
    rating: 4.6,
    reviews: 178,
    toolCount: 10,
    tools: ['list_events', 'get_event', 'cancel_event', 'list_invitees', 'create_link'],
    tags: ['productivity', 'scheduling', 'meetings', 'automation', 'verified'],
  },

  // ===== SECURITY =====
  {
    id: '1password',
    name: '1password',
    displayName: '1Password',
    description: 'Secure password and secrets management',
    longDescription: 'Enterprise password manager. Store passwords, API keys, certificates, manage vaults, and share secrets securely.',
    category: 'development',
    pricing: 'paid',
    priceDetails: 'From $2.99/user/month',
    icon: 'https://1password.com/favicon.ico',
    author: '1Password',
    homepage: 'https://1password.com',
    documentation: 'https://developer.1password.com',
    verified: true,
    transport: 'http',
    envVarsRequired: [
      {
        name: 'OP_CONNECT_TOKEN',
        description: 'Connect token from 1Password',
        required: true,
      },
      {
        name: 'OP_CONNECT_HOST',
        description: 'Connect host URL',
        required: true,
      },
    ],
    quickInstall: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-1password'],
    },
    rating: 4.8,
    reviews: 234,
    toolCount: 8,
    tools: ['get_secret', 'list_vaults', 'create_item', 'update_item', 'share_vault'],
    tags: ['security', 'passwords', 'secrets', 'encryption', 'verified'],
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
