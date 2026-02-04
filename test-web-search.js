#!/usr/bin/env node

/**
 * Comprehensive Web Search Test Script
 * Tests: DuckDuckGo, SearxNG, Content Scraping, and Agent Tool Integration
 */

const { logger } = require('@librechat/data-schemas');
const DuckDuckGoSearchTool = require('./api/app/clients/tools/structured/DuckDuckGoSearch');
const WebScraper = require('./api/app/clients/tools/util/webScraper');

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

async function testDuckDuckGoBasicSearch() {
  section('TEST 1: DuckDuckGo Basic Search (No Scraping)');
  
  try {
    const tool = new DuckDuckGoSearchTool({
      maxResults: 3,
      enableScraping: false,
    });

    log('Searching for: "artificial intelligence news 2026"', 'cyan');
    const result = await tool._call('artificial intelligence news 2026');
    const parsed = JSON.parse(result);

    log('✓ Search completed successfully!', 'green');
    log(`  Provider: ${parsed.provider}`, 'blue');
    log(`  Total results: ${parsed.total_results}`, 'blue');
    
    if (parsed.results && parsed.results.length > 0) {
      log('\n  Top result:', 'yellow');
      log(`    Title: ${parsed.results[0].title}`, 'cyan');
      log(`    URL: ${parsed.results[0].url}`, 'cyan');
      log(`    Snippet: ${parsed.results[0].snippet.substring(0, 100)}...`, 'cyan');
      return { success: true, data: parsed };
    } else {
      log('✗ No results returned', 'red');
      return { success: false, error: 'No results' };
    }
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

async function testDuckDuckGoWithScraping() {
  section('TEST 2: DuckDuckGo Search WITH Content Scraping');
  
  try {
    const tool = new DuckDuckGoSearchTool({
      maxResults: 3,
      enableScraping: true,
      scrapeTopN: 2, // Scrape top 2 results
    });

    log('Searching for: "LibreChat AI chatbot"', 'cyan');
    const result = await tool._call('LibreChat AI chatbot');
    const parsed = JSON.parse(result);

    log('✓ Search with scraping completed!', 'green');
    log(`  Provider: ${parsed.provider}`, 'blue');
    log(`  Scraped: ${parsed.scraped}`, 'blue');
    log(`  Total results: ${parsed.total_results}`, 'blue');
    
    if (parsed.results && parsed.results.length > 0) {
      const hasScrapedContent = parsed.results.some(r => r.full_content);
      
      if (hasScrapedContent) {
        log('\n✓ Content scraping successful!', 'green');
        const scrapedResult = parsed.results.find(r => r.full_content);
        log(`  Scraped URL: ${scrapedResult.url}`, 'cyan');
        log(`  Content length: ${scrapedResult.content_length} chars`, 'cyan');
        log(`  Preview: ${scrapedResult.full_content.substring(0, 150)}...`, 'cyan');
      } else {
        log('\n⚠ No scraped content found (might have failed)', 'yellow');
      }
      
      return { success: true, data: parsed, scraped: hasScrapedContent };
    } else {
      log('✗ No results returned', 'red');
      return { success: false, error: 'No results' };
    }
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

async function testWebScraperDirect() {
  section('TEST 3: Direct Web Scraper Test');
  
  try {
    const scraper = new WebScraper({
      timeout: 10000,
      maxContentLength: 20000,
    });

    const testUrls = [
      'https://www.librechat.ai',
      'https://github.com/danny-avila/LibreChat',
    ];

    log(`Scraping ${testUrls.length} URLs directly...`, 'cyan');
    
    const results = await scraper.scrapeMultiple(testUrls, 2);
    
    let successCount = 0;
    results.forEach((result, index) => {
      if (result.success) {
        successCount++;
        log(`\n✓ Scraped ${testUrls[index]}`, 'green');
        log(`  Title: ${result.title}`, 'cyan');
        log(`  Content length: ${result.length} chars`, 'cyan');
        log(`  Preview: ${result.content.substring(0, 100)}...`, 'cyan');
      } else {
        log(`\n✗ Failed to scrape ${testUrls[index]}`, 'red');
        log(`  Error: ${result.error}`, 'red');
      }
    });

    log(`\nSuccess rate: ${successCount}/${testUrls.length}`, 'blue');
    return { success: successCount > 0, successRate: successCount / testUrls.length };
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

async function testSearxNGConnection() {
  section('TEST 4: SearxNG Instance Connection Test');
  
  try {
    const searxngUrl = process.env.SEARXNG_INSTANCE_URL || 'https://etsi.me';
    
    log(`Testing connection to: ${searxngUrl}`, 'cyan');
    
    const testUrl = `${searxngUrl}/search?q=test&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(testUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LibreChat/1.0 Test',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      log('✓ SearxNG instance is accessible!', 'green');
      log(`  Status: ${response.status}`, 'blue');
      log(`  Results returned: ${data.results ? data.results.length : 0}`, 'blue');
      return { success: true, instance: searxngUrl };
    } else {
      log(`✗ SearxNG returned status ${response.status}`, 'red');
      return { success: false, status: response.status };
    }
  } catch (error) {
    log(`✗ Failed to connect to SearxNG: ${error.message}`, 'red');
    log('  Tip: Try a different instance in .env (SEARXNG_INSTANCE_URL)', 'yellow');
    return { success: false, error: error.message };
  }
}

async function testAgentToolIntegration() {
  section('TEST 5: Agent Tool Call Simulation');
  
  try {
    log('Simulating an agent tool call...', 'cyan');
    
    const tool = new DuckDuckGoSearchTool({
      maxResults: 5,
      enableScraping: true,
      scrapeTopN: 3,
    });

    // Simulate what an agent would do
    log('\nAgent Query: "What are the latest features in LibreChat?"', 'yellow');
    
    const searchResult = await tool._call('latest features LibreChat 2026');
    const parsed = JSON.parse(searchResult);
    
    // Simulate agent processing
    log('\n✓ Agent received search results', 'green');
    log(`  Total results: ${parsed.total_results}`, 'blue');
    
    if (parsed.results && parsed.results.length > 0) {
      // Count results with scraped content
      const withContent = parsed.results.filter(r => r.full_content).length;
      
      log(`  Results with full content: ${withContent}/${parsed.results.length}`, 'blue');
      
      // Simulate agent synthesizing an answer
      log('\n📝 Agent would synthesize answer using:', 'yellow');
      parsed.results.slice(0, 3).forEach((result, i) => {
        log(`  ${i + 1}. ${result.title}`, 'cyan');
        if (result.full_content) {
          log(`     [Has ${result.content_length} chars of content]`, 'green');
        } else {
          log(`     [Only has snippet: ${result.snippet.substring(0, 50)}...]`, 'yellow');
        }
      });
      
      return { 
        success: true, 
        resultsCount: parsed.results.length,
        withFullContent: withContent,
      };
    } else {
      log('✗ No results to process', 'red');
      return { success: false, error: 'No results' };
    }
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  log('╔════════════════════════════════════════════════════════════════╗', 'bright');
  log('║     LibreChat Web Search & Crawling Comprehensive Tests       ║', 'bright');
  log('╚════════════════════════════════════════════════════════════════╝', 'bright');
  
  const results = {};
  
  // Run all tests
  results.test1 = await testDuckDuckGoBasicSearch();
  results.test2 = await testDuckDuckGoWithScraping();
  results.test3 = await testWebScraperDirect();
  results.test4 = await testSearxNGConnection();
  results.test5 = await testAgentToolIntegration();
  
  // Summary
  section('FINAL TEST SUMMARY');
  
  const tests = [
    { name: 'DuckDuckGo Basic Search', result: results.test1 },
    { name: 'DuckDuckGo with Scraping', result: results.test2 },
    { name: 'Direct Web Scraper', result: results.test3 },
    { name: 'SearxNG Connection', result: results.test4 },
    { name: 'Agent Tool Integration', result: results.test5 },
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ name, result }) => {
    if (result.success) {
      log(`✓ ${name}`, 'green');
      passed++;
    } else {
      log(`✗ ${name}`, 'red');
      failed++;
    }
  });
  
  console.log('\n' + '-'.repeat(70));
  log(`Total: ${passed} passed, ${failed} failed`, 'bright');
  
  if (passed === tests.length) {
    log('\n🎉 ALL TESTS PASSED! Web search is fully functional!', 'green');
  } else if (passed > 0) {
    log(`\n⚠️  ${passed}/${tests.length} tests passed. Some features may need attention.`, 'yellow');
  } else {
    log('\n❌ All tests failed. Please check your configuration.', 'red');
  }
  
  console.log('\n');
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
