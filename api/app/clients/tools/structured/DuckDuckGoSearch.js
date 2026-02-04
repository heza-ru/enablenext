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

  async _call(input, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 2000;
    
    try {
      logger.info(`[DuckDuckGoSearch] Searching for: "${input}" (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Dynamic import of duck-duck-scrape
      const { search } = await import('duck-duck-scrape');
      
      // Add timeout wrapper
      const searchPromise = search(input);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout after 10s')), 10000)
      );
      
      const searchResults = await Promise.race([searchPromise, timeoutPromise]);

      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        logger.warn('[DuckDuckGoSearch] No results found for query:', input);
        return JSON.stringify({
          query: input,
          results: [],
          provider: 'DuckDuckGo (FREE)',
          message: 'No results found for this query. Try different keywords or check spelling.',
        });
      }

      // Format results for the AI with enhanced data
      let results = searchResults.results.slice(0, this.maxResults).map((result, index) => ({
        position: index + 1,
        title: result.title || 'Untitled',
        snippet: result.description || '',
        url: result.url || '',
        content: result.description || '', // Alias for compatibility
        relevance_score: Math.max(0, 1 - (index * 0.1)), // Simple relevance scoring
      }));

      logger.info(`[DuckDuckGoSearch] Found ${results.length} results`);

      // Enrich results with scraped content if enabled
      if (this.enableScraping && results.length > 0) {
        try {
          logger.info(`[DuckDuckGoSearch] Enriching top ${this.scrapeTopN} results with full content`);
          results = await this.scraper.enrichSearchResults(results, this.scrapeTopN);
          logger.info('[DuckDuckGoSearch] Content enrichment completed successfully');
        } catch (scrapeError) {
          logger.warn('[DuckDuckGoSearch] Content enrichment failed, returning results with snippets only:', scrapeError.message);
        }
      }

      // Return structured data with comprehensive metadata
      return JSON.stringify({
        query: input,
        results,
        total_results: results.length,
        provider: 'DuckDuckGo (FREE - unlimited searches)',
        features: {
          content_scraping: this.enableScraping,
          enhanced_extraction: true,
          rate_limit_protected: true,
        },
        timestamp: new Date().toISOString(),
      }, null, 2);
    } catch (error) {
      logger.error(`[DuckDuckGoSearch] Error on attempt ${retryCount + 1}:`, error);
      
      // Retry logic for transient failures
      if (retryCount < maxRetries && (
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('fetch failed')
      )) {
        const backoffDelay = retryDelay * Math.pow(2, retryCount);
        logger.info(`[DuckDuckGoSearch] Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this._call(input, retryCount + 1);
      }
      
      // Return error in structured format instead of throwing
      return JSON.stringify({
        query: input,
        results: [],
        provider: 'DuckDuckGo (FREE)',
        error: `Search failed after ${retryCount + 1} attempts: ${error.message}`,
        suggestion: 'Try rephrasing your query or try again in a moment.',
      });
    }
  }
}

module.exports = DuckDuckGoSearchTool;
