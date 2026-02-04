const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const WebScraper = require('../util/webScraper');

/**
 * DuckDuckGo Search Tool - FREE, no API key required
 * Uses duck-duck-scrape for web searches with optional content scraping
 */
class DuckDuckGoSearchTool extends Tool {
  constructor(fields = {}) {
    super();
    this.name = 'duckduckgo_search';
    this.description = `Search the web using DuckDuckGo and retrieve full content from top results. Use this when you need current information, recent news, latest updates, or real-time data with detailed content.
Input should be a search query string.
Returns search results with titles, snippets, URLs, and full page content from top results.`;
    this.maxResults = fields.maxResults || 5;
    this.enableScraping = fields.enableScraping !== false; // Enable by default
    this.scrapeTopN = fields.scrapeTopN || 3; // Scrape top 3 results by default
    this.scraper = new WebScraper({
      timeout: fields.scraperTimeout || 10000,
      maxContentLength: fields.maxContentLength || 30000,
    });
  }

  async _call(input) {
    try {
      logger.info('[DuckDuckGoSearch] Searching for:', input);
      
      // Dynamic import of duck-duck-scrape
      const { search } = await import('duck-duck-scrape');
      
      // Note: duck-duck-scrape v2.2.7+ doesn't support safeSearch parameter
      const searchResults = await search(input);

      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        logger.warn('[DuckDuckGoSearch] No results found for query:', input);
        return JSON.stringify({
          query: input,
          results: [],
          provider: 'DuckDuckGo (FREE)',
          message: 'No results found for this query.',
        });
      }

      // Format results for the AI with enhanced data
      let results = searchResults.results.slice(0, this.maxResults).map((result, index) => ({
        position: index + 1,
        title: result.title || 'Untitled',
        snippet: result.description || '',
        url: result.url || '',
        content: result.description || '', // Alias for compatibility
      }));

      logger.info(`[DuckDuckGoSearch] Found ${results.length} results`);

      // Enrich results with scraped content if enabled
      if (this.enableScraping && results.length > 0) {
        try {
          logger.info(`[DuckDuckGoSearch] Scraping top ${this.scrapeTopN} results for full content`);
          results = await this.scraper.enrichSearchResults(results, this.scrapeTopN);
          logger.info('[DuckDuckGoSearch] Content scraping completed');
        } catch (scrapeError) {
          logger.warn('[DuckDuckGoSearch] Scraping failed, returning results without full content:', scrapeError.message);
        }
      }

      // Return structured data with metadata
      return JSON.stringify({
        query: input,
        results,
        total_results: results.length,
        provider: 'DuckDuckGo (FREE with content scraping)',
        scraped: this.enableScraping,
        timestamp: new Date().toISOString(),
      }, null, 2);
    } catch (error) {
      logger.error('[DuckDuckGoSearch] Error:', error);
      // Return error in structured format instead of throwing
      return JSON.stringify({
        query: input,
        results: [],
        provider: 'DuckDuckGo (FREE)',
        error: `Search failed: ${error.message}`,
      });
    }
  }
}

module.exports = DuckDuckGoSearchTool;
