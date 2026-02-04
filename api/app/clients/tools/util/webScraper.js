const { logger } = require('@librechat/data-schemas');

/**
 * Enhanced web scraper with retry logic, rate limiting, and better content extraction
 * FREE - no API keys needed!
 * Implements fallback strategies for robust web content retrieval
 */
class WebScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 15000; // Increased to 15s for quality
    this.maxContentLength = options.maxContentLength || 50000; // ~50KB
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // Rate limiting and retry config
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000; // Start with 2s
    this.requestQueue = [];
    this.rateLimitDelay = options.rateLimitDelay || 1000; // 1s between requests
    this.lastRequestTime = 0;
  }
  
  /**
   * Wait to respect rate limits
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      logger.debug(`[WebScraper] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Enhanced content extraction - extracts main content with better quality
   * Implements simplified Readability-style algorithm
   */
  extractMainContent(html, url) {
    try {
      // Remove unwanted elements
      let cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
      
      // Try to extract main content area (article, main, or content divs)
      const mainMatch = cleaned.match(/<(?:article|main|div[^>]*(?:class|id)=["'][^"']*(?:content|article|post|entry|main)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:article|main|div)>/i);
      if (mainMatch) {
        cleaned = mainMatch[1];
      }
      
      // Convert to text and clean up
      let content = cleaned
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      
      return content;
    } catch (error) {
      logger.error('[WebScraper] Content extraction error:', error);
      // Fallback to simple extraction
      return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  /**
   * Fetch and parse content from a URL with retry logic and enhanced extraction
   * @param {string} url - The URL to scrape
   * @param {number} retryCount - Current retry attempt (internal)
   * @returns {Promise<{success: boolean, url: string, title?: string, content?: string, error?: string, metadata?: object}>}
   */
  async scrape(url, retryCount = 0) {
    try {
      // Rate limiting
      await this.waitForRateLimit();
      
      logger.info(`[WebScraper] Fetching: ${url} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 && retryCount < this.maxRetries) {
          // Rate limited - retry with exponential backoff
          const backoffDelay = this.retryDelay * Math.pow(2, retryCount);
          logger.warn(`[WebScraper] Rate limited (429), retrying in ${backoffDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return this.scrape(url, retryCount + 1);
        }
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
      
      // Truncate if too large before processing
      if (html.length > this.maxContentLength * 3) {
        html = html.substring(0, this.maxContentLength * 3);
      }

      // Extract metadata
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      const descMatch = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i);
      const description = descMatch ? descMatch[1].trim() : '';
      
      const authorMatch = html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i);
      const author = authorMatch ? authorMatch[1].trim() : '';

      // Enhanced content extraction
      let content = this.extractMainContent(html, url);

      // Limit final content length
      if (content.length > this.maxContentLength) {
        content = content.substring(0, this.maxContentLength) + '...';
      }

      logger.info(`[WebScraper] Successfully scraped ${content.length} chars from: ${url}`);

      return {
        success: true,
        url,
        title,
        description,
        content,
        length: content.length,
        metadata: {
          author,
          contentType,
          scrapedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      // Retry on network errors
      if (retryCount < this.maxRetries && (error.name === 'AbortError' || error.message.includes('fetch failed'))) {
        const backoffDelay = this.retryDelay * Math.pow(2, retryCount);
        logger.warn(`[WebScraper] Error scraping ${url}, retrying in ${backoffDelay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this.scrape(url, retryCount + 1);
      }
      
      logger.error(`[WebScraper] Failed to scrape ${url} after ${retryCount + 1} attempts:`, error);
      return {
        success: false,
        url,
        error: error.message || 'Scraping failed',
        attempts: retryCount + 1,
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
