#!/usr/bin/env node

/**
 * Simple Web Search Test - No dependencies
 * Tests DuckDuckGo search and web scraping functionality
 */

// Simple logger replacement
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Test 1: DuckDuckGo Search
async function testDuckDuckGoSearch() {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 1: DuckDuckGo Web Search', 'bright');
  log('='.repeat(60), 'bright');
  
  try {
    const { search } = await import('duck-duck-scrape');
    
    log('\nSearching: "LibreChat AI"', 'cyan');
    const results = await search('LibreChat AI');
    
    if (results && results.results && results.results.length > 0) {
      log(`✓ SUCCESS: Found ${results.results.length} results`, 'green');
      log('\nTop 3 results:', 'yellow');
      
      results.results.slice(0, 3).forEach((r, i) => {
        log(`\n${i + 1}. ${r.title}`, 'cyan');
        log(`   URL: ${r.url}`, 'cyan');
        log(`   Snippet: ${r.description.substring(0, 100)}...`, 'cyan');
      });
      
      return { success: true, count: results.results.length };
    } else {
      log('✗ FAIL: No results returned', 'red');
      return { success: false, error: 'No results' };
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// Test 2: Web Scraping
async function testWebScraping() {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 2: Web Content Scraping', 'bright');
  log('='.repeat(60), 'bright');
  
  try {
    const testUrl = 'https://www.librechat.ai';
    log(`\nScraping: ${testUrl}`, 'cyan');
    
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LibreChat/1.0)',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'No title';
      
      // Extract text content
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      log(`✓ SUCCESS: Scraped content`, 'green');
      log(`  Title: ${title}`, 'cyan');
      log(`  Content length: ${text.length} chars`, 'cyan');
      log(`  Preview: ${text.substring(0, 150)}...`, 'cyan');
      
      return { success: true, length: text.length };
    } else {
      log(`✗ FAIL: HTTP ${response.status}`, 'red');
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// Test 3: SearxNG Connection
async function testSearxNG() {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 3: SearxNG Instance Connection', 'bright');
  log('='.repeat(60), 'bright');
  
  try {
    const searxngUrl = process.env.SEARXNG_INSTANCE_URL || 'https://etsi.me';
    log(`\nTesting: ${searxngUrl}`, 'cyan');
    
    const testUrl = `${searxngUrl}/search?q=test&format=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(testUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LibreChat/1.0',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      log(`✓ SUCCESS: SearxNG accessible`, 'green');
      log(`  Status: ${response.status}`, 'cyan');
      log(`  Results: ${data.results ? data.results.length : 0}`, 'cyan');
      
      return { success: true, instance: searxngUrl };
    } else {
      log(`✗ FAIL: HTTP ${response.status}`, 'red');
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    log('  Tip: Try different instance in .env', 'yellow');
    return { success: false, error: error.message };
  }
}

// Test 4: Combined Search + Scrape
async function testCombinedSearchAndScrape() {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 4: Search + Content Scraping (Like Agents Do)', 'bright');
  log('='.repeat(60), 'bright');
  
  try {
    const { search } = await import('duck-duck-scrape');
    
    log('\nSearching: "Node.js documentation"', 'cyan');
    const searchResults = await search('Node.js documentation');
    
    if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
      throw new Error('No search results');
    }
    
    log(`✓ Found ${searchResults.results.length} search results`, 'green');
    
    // Scrape top result
    const topResult = searchResults.results[0];
    log(`\nScraping top result: ${topResult.url}`, 'cyan');
    
    const response = await fetch(topResult.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LibreChat/1.0)',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      const content = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      log('✓ SUCCESS: Complete search + scrape workflow', 'green');
      log(`  Search result: ${topResult.title}`, 'cyan');
      log(`  Scraped content: ${content.length} chars`, 'cyan');
      log(`  Combined data ready for agent processing!`, 'green');
      
      return { success: true, searchResults: searchResults.results.length, scraped: true };
    } else {
      log(`⚠ Search OK, but scraping failed (HTTP ${response.status})`, 'yellow');
      return { success: true, searchResults: searchResults.results.length, scraped: false };
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// Main runner
async function runTests() {
  log('\n╔══════════════════════════════════════════════════════════════╗', 'bright');
  log('║    LibreChat Web Search Functionality Test Suite            ║', 'bright');
  log('╚══════════════════════════════════════════════════════════════╝\n', 'bright');
  
  const results = {
    test1: await testDuckDuckGoSearch(),
    test2: await testWebScraping(),
    test3: await testSearxNG(),
    test4: await testCombinedSearchAndScrape(),
  };
  
  // Summary
  log('\n' + '='.repeat(60), 'bright');
  log('TEST SUMMARY', 'bright');
  log('='.repeat(60), 'bright');
  
  const tests = [
    { name: 'DuckDuckGo Search', result: results.test1 },
    { name: 'Web Scraping', result: results.test2 },
    { name: 'SearxNG Connection', result: results.test3 },
    { name: 'Combined Search+Scrape', result: results.test4 },
  ];
  
  let passed = 0;
  tests.forEach(({ name, result }) => {
    if (result.success) {
      log(`✓ ${name}`, 'green');
      passed++;
    } else {
      log(`✗ ${name}: ${result.error || 'Failed'}`, 'red');
    }
  });
  
  log(`\nResults: ${passed}/${tests.length} tests passed`, 'bright');
  
  if (passed === tests.length) {
    log('\n🎉 ALL TESTS PASSED! Search functionality is working!', 'green');
    log('\n✓ DuckDuckGo search: Working', 'green');
    log('✓ Web scraping: Working', 'green');
    log('✓ SearxNG: Working', 'green');
    log('✓ Combined workflow: Working', 'green');
    log('\n✓ Agents can now:', 'yellow');
    log('  - Search the web with DuckDuckGo (FREE)', 'cyan');
    log('  - Search with SearxNG (FREE)', 'cyan');
    log('  - Scrape full content from search results', 'cyan');
    log('  - Access rich data for answering queries', 'cyan');
  } else {
    log(`\n⚠️  ${passed}/${tests.length} tests passed`, 'yellow');
  }
  
  console.log('\n');
  process.exit(passed === tests.length ? 0 : 1);
}

runTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
