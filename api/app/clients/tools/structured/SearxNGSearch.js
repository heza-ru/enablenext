const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const WebScraper = require('../util/webScraper');

/**
 * SearxNG Search Tool - FREE, no API key required, NO rate limits!
 * Uses SearxNG metasearch engine with optional content scraping
 */
class SearxNGSearchTool extends Tool {
  constructor(fields = {}) {
    super();
    this.name = 'web_search'; // MUST match what agents expect
    this.description = `Search the web using SearxNG and retrieve full content from top results. Use this when you need current information, recent news, latest updates, or real-time data with detailed content.
Input should be a search query string.
Returns search results with titles, snippets, URLs, and full page content from top results.`;
    this.searxngUrl = fields.searxngUrl || 'https://etsi.me';
    this.maxResults = fields.maxResults || 5;
    this.enableScraping = fields.enableScraping !== false;
    this.scrapeTopN = fields.scrapeTopN || 3;
    this.scraper = new WebScraper({
      timeout: fields.scraperTimeout || 10000,
      maxContentLength: fields.maxContentLength || 30000,
    });
  }

  async _call(input, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 2000;
    
    try {
      logger.info(`[SearxNGSearch] Searching for: "${input}" (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      const searchUrl = `${this.searxngUrl}/search?q=${encodeURIComponent(input)}&format=json`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LibreChat/1.0',
        },
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`SearxNG HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        logger.warn('[SearxNGSearch] No results found for query:', input);
        return JSON.stringify({
          query: input,
          results: [],
          provider: 'SearxNG (FREE)',
          message: 'No results found for this query. Try different keywords or check spelling.',
        });
      }

      // Format results for the AI
      let results = data.results.slice(0, this.maxResults).map((result, index) => ({
        position: index + 1,
        title: result.title || 'Untitled',
        snippet: result.content || result.description || '',
        url: result.url || '',
        content: result.content || result.description || '',
        relevance_score: Math.max(0, 1 - (index * 0.1)),
      }));

      logger.info(`[SearxNGSearch] Found ${results.length} results`);

      // Enrich results with scraped content if enabled
      if (this.enableScraping && results.length > 0) {
        try {
          logger.info(`[SearxNGSearch] Enriching top ${this.scrapeTopN} results with full content`);
          results = await this.scraper.enrichSearchResults(results, this.scrapeTopN);
          logger.info('[SearxNGSearch] Content enrichment completed successfully');
        } catch (scrapeError) {
          logger.warn('[SearxNGSearch] Content enrichment failed, returning results with snippets only:', scrapeError.message);
        }
      }

      return JSON.stringify({
        query: input,
        results,
        total_results: results.length,
        provider: 'SearxNG (FREE - unlimited searches, privacy-focused)',
        features: {
          content_scraping: this.enableScraping,
          enhanced_extraction: true,
          rate_limit_protected: true,
        },
        timestamp: new Date().toISOString(),
      }, null, 2);
    } catch (error) {
      logger.error(`[SearxNGSearch] Error on attempt ${retryCount + 1}:`, error);
      
      // Retry logic for transient failures
      if (retryCount < maxRetries && (
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('fetch failed') ||
        error.message.includes('aborted')
      )) {
        const backoffDelay = retryDelay * Math.pow(2, retryCount);
        logger.info(`[SearxNGSearch] Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this._call(input, retryCount + 1);
      }
      
      return JSON.stringify({
        query: input,
        results: [],
        provider: 'SearxNG (FREE)',
        error: `Search failed after ${retryCount + 1} attempts: ${error.message}`,
        suggestion: 'Try rephrasing your query or try again in a moment.',
      });
    }
  }
}

module.exports = SearxNGSearchTool;
