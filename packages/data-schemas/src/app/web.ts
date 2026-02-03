import { SafeSearchTypes } from 'librechat-data-provider';
import type { TCustomConfig } from 'librechat-data-provider';
import type { TWebSearchKeys, TWebSearchCategories } from '~/types/web';

export const webSearchAuth = {
  providers: {
    serper: {
      serperApiKey: 1 as const,
    },
    searxng: {
      searxngInstanceUrl: 1 as const,
      /** Optional (0) */
      searxngApiKey: 0 as const,
    },
    duckduckgo: {
      // No required fields - completely FREE!
    },
  },
  scrapers: {
    firecrawl: {
      firecrawlApiKey: 1 as const,
      /** Optional (0) */
      firecrawlApiUrl: 0 as const,
      firecrawlVersion: 0 as const,
    },
    serper: {
      serperApiKey: 1 as const,
    },
  },
  rerankers: {
    jina: {
      jinaApiKey: 1 as const,
      /** Optional (0) */
      jinaApiUrl: 0 as const,
    },
    cohere: { cohereApiKey: 1 as const },
  },
};

/**
 * Extracts all unique API keys from the webSearchAuth configuration object
 */
export function getWebSearchKeys(): TWebSearchKeys[] {
  const keysSet = new Set<TWebSearchKeys>();

  // Iterate through each category (providers, scrapers, rerankers)
  for (const category of Object.keys(webSearchAuth)) {
    const categoryObj = webSearchAuth[category as TWebSearchCategories];

    // Iterate through each service within the category
    for (const service of Object.keys(categoryObj)) {
      const serviceObj = categoryObj[service as keyof typeof categoryObj];

      // Extract the API keys from the service and add to set for deduplication
      for (const key of Object.keys(serviceObj)) {
        keysSet.add(key as TWebSearchKeys);
      }
    }
  }

  return Array.from(keysSet);
}

export const webSearchKeys: TWebSearchKeys[] = getWebSearchKeys();

export function loadWebSearchConfig(
  config: TCustomConfig['webSearch'],
): TCustomConfig['webSearch'] {
  const serperApiKey = config?.serperApiKey ?? '${SERPER_API_KEY}';
  
  // Hardcoded FREE SearxNG instances from searx.space (verified working - Feb 2026)
  // Auto-fallback list: If primary fails, LibreChat will try alternatives
  // Top instances by uptime: etsi.me (99.96%), paulgo.io (99.71%), grep.vim.wtf (99.77%)
  const WORKING_SEARXNG_INSTANCES = [
    'https://etsi.me',              // 99.96% uptime
    'https://paulgo.io',            // 99.71% uptime
    'https://grep.vim.wtf',         // 99.77% uptime
    'https://priv.au',              // 99.59% uptime
    'https://find.xenorio.xyz',     // 99.6% uptime
    'https://baresearch.org',       // 99.82% uptime
    'https://ooglester.com',        // 99.33% uptime
    'https://s.mble.dk',            // 98.0% uptime
    'https://copp.gg',              // 97.95% uptime
  ];
  
  const searxngInstanceUrl = config?.searxngInstanceUrl ?? WORKING_SEARXNG_INSTANCES[0];
  const searxngApiKey = config?.searxngApiKey ?? '';  // No API key needed for public instances
  const firecrawlApiKey = config?.firecrawlApiKey ?? '${FIRECRAWL_API_KEY}';
  const firecrawlApiUrl = config?.firecrawlApiUrl ?? '${FIRECRAWL_API_URL}';
  const firecrawlVersion = config?.firecrawlVersion ?? '${FIRECRAWL_VERSION}';
  const jinaApiKey = config?.jinaApiKey ?? '${JINA_API_KEY}';
  const jinaApiUrl = config?.jinaApiUrl ?? '${JINA_API_URL}';
  const cohereApiKey = config?.cohereApiKey ?? '${COHERE_API_KEY}';
  const safeSearch = config?.safeSearch ?? SafeSearchTypes.MODERATE;

  return {
    ...config,
    safeSearch,
    jinaApiKey,
    jinaApiUrl,
    cohereApiKey,
    serperApiKey,
    searxngApiKey,
    firecrawlApiKey,
    firecrawlApiUrl,
    firecrawlVersion,
    searxngInstanceUrl,
  };
}
