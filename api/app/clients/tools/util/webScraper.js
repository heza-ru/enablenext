const { logger } = require('@librechat/data-schemas');

/**
 * Simple web scraper for extracting content from URLs
 * FREE - no API keys needed!
 */
class WebScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.maxContentLength = options.maxContentLength || 50000; // ~50KB
    this.userAgent = options.userAgent || 'Mozilla/5.0 (compatible; LibreChat/1.0)';
  }

  /**
   * Fetch and parse content from a URL
   * @param {string} url - The URL to scrape
   * @returns {Promise<{success: boolean, url: string, title?: string, content?: string, error?: string}>}
   */
  async scrape(url) {
    try {
      logger.info('[WebScraper] Fetching:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        logger.warn('[WebScraper] Non-HTML content type:', contentType);
        return {
          success: false,
          url,
          error: 'Content type not supported',
        };
      }

      let html = await response.text();
      
      // Truncate if too large
      if (html.length > this.maxContentLength) {
        html = html.substring(0, this.maxContentLength);
      }

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Simple content extraction - remove scripts, styles, and HTML tags
      let content = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limit content length
      if (content.length > this.maxContentLength) {
        content = content.substring(0, this.maxContentLength) + '...';
      }

      logger.info(`[WebScraper] Scraped ${content.length} chars from:`, url);

      return {
        success: true,
        url,
        title,
        content,
        length: content.length,
      };
    } catch (error) {
      logger.error('[WebScraper] Error scraping:', url, error);
      return {
        success: false,
        url,
        error: error.message || 'Scraping failed',
      };
    }
  }

  /**
   * Scrape multiple URLs in parallel
   * @param {string[]} urls - Array of URLs to scrape
   * @param {number} maxConcurrent - Maximum concurrent requests (default: 3)
   * @returns {Promise<Array>}
   */
  async scrapeMultiple(urls, maxConcurrent = 3) {
    const results = [];
    const queue = [...urls];

    while (queue.length > 0) {
      const batch = queue.splice(0, maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(url => this.scrape(url))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Extract main content from search results and scrape URLs
   * @param {Array} searchResults - Search results with URLs
   * @param {number} maxUrls - Maximum URLs to scrape (default: 3)
   * @returns {Promise<Array>}
   */
  async enrichSearchResults(searchResults, maxUrls = 3) {
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return searchResults;
    }

    // Get top URLs
    const urlsToScrape = searchResults
      .slice(0, maxUrls)
      .filter(result => result.url)
      .map(result => result.url);

    if (urlsToScrape.length === 0) {
      return searchResults;
    }

    logger.info(`[WebScraper] Enriching ${urlsToScrape.length} search results with scraped content`);

    // Scrape URLs
    const scrapedData = await this.scrapeMultiple(urlsToScrape);

    // Create a map of URL to scraped content
    const contentMap = new Map();
    scrapedData.forEach(data => {
      if (data.success) {
        contentMap.set(data.url, data);
      }
    });

    // Enrich search results with scraped content
    const enrichedResults = searchResults.map(result => {
      const scraped = contentMap.get(result.url);
      if (scraped && scraped.success) {
        return {
          ...result,
          full_content: scraped.content,
          scraped_title: scraped.title,
          content_length: scraped.length,
        };
      }
      return result;
    });

    return enrichedResults;
  }
}

module.exports = WebScraper;
