const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');

/**
 * DuckDuckGo Search Tool - FREE, no API key required
 * Uses duck-duck-scrape for web searches
 */
class DuckDuckGoSearchTool extends Tool {
  constructor(fields = {}) {
    super();
    this.name = 'duckduckgo_search';
    this.description = `Search the web using DuckDuckGo. Use this when you need current information, recent news, latest updates, or real-time data. 
Input should be a search query string.
Returns search results with titles, snippets, and URLs.`;
    this.maxResults = fields.maxResults || 5;
  }

  async _call(input) {
    try {
      logger.info('[DuckDuckGoSearch] Searching for:', input);
      
      // Dynamic import of duck-duck-scrape
      const { search } = await import('duck-duck-scrape');
      
      const searchResults = await search(input, {
        safeSearch: 1, // 0=off, 1=moderate, 2=strict
      });

      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        logger.warn('[DuckDuckGoSearch] No results found for query:', input);
        return 'No search results found.';
      }

      // Format results for the AI
      const results = searchResults.results.slice(0, this.maxResults).map((result, index) => ({
        position: index + 1,
        title: result.title,
        snippet: result.description,
        url: result.url,
      }));

      logger.info(`[DuckDuckGoSearch] Found ${results.length} results`);

      return JSON.stringify({
        query: input,
        results,
        provider: 'DuckDuckGo (FREE)',
      }, null, 2);
    } catch (error) {
      logger.error('[DuckDuckGoSearch] Error:', error);
      throw new Error(`DuckDuckGo search failed: ${error.message}`);
    }
  }
}

module.exports = DuckDuckGoSearchTool;
