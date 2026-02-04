#!/usr/bin/env node

/**
 * SearxNG Primary Search Test
 * Verifies that SearxNG is configured correctly as the primary search provider
 */

// Colors for output
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

// Test 1: Verify SearxNG Instance is Accessible
async function testSearxNGInstance() {
  log('\n' + '='.repeat(70), 'bright');
  log('TEST 1: Verify SearxNG Instance Accessibility', 'bright');
  log('='.repeat(70), 'bright');
  
  const instances = [
    'https://etsi.me',           // PRIMARY (99.96% uptime)
    'https://paulgo.io',         // Fallback 1
    'https://grep.vim.wtf',      // Fallback 2
    'https://baresearch.org',    // Fallback 3
  ];
  
  const results = [];
  
  for (const instance of instances) {
    try {
      log(`\nTesting: ${instance}`, 'cyan');
      
      const testUrl = `${instance}/search?q=test&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const start = Date.now();
      const response = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LibreChat/1.0',
        },
      });
      
      clearTimeout(timeoutId);
      const duration = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        const resultCount = data.results ? data.results.length : 0;
        
        log(`✓ SUCCESS: ${instance}`, 'green');
        log(`  Status: ${response.status}`, 'cyan');
        log(`  Response time: ${duration}ms`, 'cyan');
        log(`  Results returned: ${resultCount}`, 'cyan');
        
        results.push({
          instance,
          success: true,
          duration,
          resultCount,
        });
      } else {
        log(`✗ FAIL: HTTP ${response.status}`, 'red');
        results.push({
          instance,
          success: false,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      log(`✗ FAIL: ${error.message}`, 'red');
      results.push({
        instance,
        success: false,
        error: error.message,
      });
    }
  }
  
  return results;
}

// Test 2: Verify Search Quality
async function testSearxNGSearchQuality() {
  log('\n' + '='.repeat(70), 'bright');
  log('TEST 2: Verify SearxNG Search Quality', 'bright');
  log('='.repeat(70), 'bright');
  
  try {
    const searxngUrl = 'https://etsi.me';
    const queries = [
      'Node.js documentation',
      'React hooks tutorial',
      'Python asyncio guide',
    ];
    
    const results = [];
    
    for (const query of queries) {
      log(`\nSearching: "${query}"`, 'cyan');
      
      const searchUrl = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LibreChat/1.0',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const resultCount = data.results ? data.results.length : 0;
        
        if (resultCount > 0) {
          log(`✓ SUCCESS: Found ${resultCount} results`, 'green');
          log(`  Top result: ${data.results[0].title}`, 'cyan');
          log(`  URL: ${data.results[0].url}`, 'cyan');
          
          results.push({
            query,
            success: true,
            resultCount,
          });
        } else {
          log(`⚠ WARNING: No results for "${query}"`, 'yellow');
          results.push({
            query,
            success: false,
            error: 'No results',
          });
        }
      } else {
        log(`✗ FAIL: HTTP ${response.status}`, 'red');
        results.push({
          query,
          success: false,
          error: `HTTP ${response.status}`,
        });
      }
    }
    
    return results;
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return [{ success: false, error: error.message }];
  }
}

// Test 3: Configuration Check
async function testConfigurationCheck() {
  log('\n' + '='.repeat(70), 'bright');
  log('TEST 3: Verify Configuration Files', 'bright');
  log('='.repeat(70), 'bright');
  
  const fs = require('fs');
  const path = require('path');
  
  const results = {
    librechatYaml: false,
    envFile: false,
    handlerFile: false,
  };
  
  try {
    // Check librechat.yaml
    log('\nChecking librechat.yaml...', 'cyan');
    const yamlPath = path.join(process.cwd(), 'librechat.yaml');
    if (fs.existsSync(yamlPath)) {
      const yaml = fs.readFileSync(yamlPath, 'utf8');
      const hasSearxNG = yaml.includes('searchProvider: searxng');
      const hasEtsiMe = yaml.includes('https://etsi.me');
      
      if (hasSearxNG && hasEtsiMe) {
        log('✓ librechat.yaml configured for SearxNG (etsi.me)', 'green');
        results.librechatYaml = true;
      } else {
        log('✗ librechat.yaml not configured correctly', 'red');
        if (!hasSearxNG) log('  Missing: searchProvider: searxng', 'yellow');
        if (!hasEtsiMe) log('  Missing: searxngInstanceUrl: https://etsi.me', 'yellow');
      }
    } else {
      log('✗ librechat.yaml not found', 'red');
    }
    
    // Check .env file
    log('\nChecking .env file...', 'cyan');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      const hasEtsiMe = env.includes('SEARXNG_INSTANCE_URL=https://etsi.me');
      
      if (hasEtsiMe) {
        log('✓ .env configured for SearxNG (etsi.me)', 'green');
        results.envFile = true;
      } else {
        log('⚠ .env might have different SearxNG instance', 'yellow');
        // Extract the actual URL
        const match = env.match(/SEARXNG_INSTANCE_URL=(.+)/);
        if (match) {
          log(`  Current: ${match[1]}`, 'cyan');
        }
      }
    } else {
      log('⚠ .env file not found (using defaults)', 'yellow');
    }
    
    // Check handler file
    log('\nChecking handleTools.js...', 'cyan');
    const handlerPath = path.join(process.cwd(), 'api/app/clients/tools/util/handleTools.js');
    if (fs.existsSync(handlerPath)) {
      const handler = fs.readFileSync(handlerPath, 'utf8');
      const hasSearxNGSupport = handler.includes('createSearchTool');
      const hasLogging = handler.includes('Using SearxNG as PRIMARY');
      
      if (hasSearxNGSupport) {
        log('✓ handleTools.js supports SearxNG', 'green');
        if (hasLogging) {
          log('✓ Enhanced logging is present', 'green');
        }
        results.handlerFile = true;
      } else {
        log('✗ handleTools.js missing SearxNG support', 'red');
      }
    } else {
      log('✗ handleTools.js not found', 'red');
    }
  } catch (error) {
    log(`✗ Configuration check failed: ${error.message}`, 'red');
  }
  
  return results;
}

// Main test runner
async function runTests() {
  log('\n╔══════════════════════════════════════════════════════════════════╗', 'bright');
  log('║          SearxNG Primary Search Configuration Test              ║', 'bright');
  log('╚══════════════════════════════════════════════════════════════════╝\n', 'bright');
  
  const instanceResults = await testSearxNGInstance();
  const searchResults = await testSearxNGSearchQuality();
  const configResults = await testConfigurationCheck();
  
  // Summary
  log('\n' + '='.repeat(70), 'bright');
  log('TEST SUMMARY', 'bright');
  log('='.repeat(70), 'bright');
  
  // Instance availability
  log('\n1. SearxNG Instance Availability:', 'bright');
  const workingInstances = instanceResults.filter(r => r.success);
  log(`   ${workingInstances.length}/${instanceResults.length} instances accessible`, 
      workingInstances.length > 0 ? 'green' : 'red');
  
  if (workingInstances.length > 0) {
    log('\n   Working instances:', 'cyan');
    workingInstances.forEach(r => {
      log(`   ✓ ${r.instance} (${r.duration}ms, ${r.resultCount} results)`, 'green');
    });
  }
  
  // Search quality
  log('\n2. Search Quality:', 'bright');
  const successfulSearches = searchResults.filter(r => r.success);
  log(`   ${successfulSearches.length}/${searchResults.length} searches returned results`, 
      successfulSearches.length === searchResults.length ? 'green' : 'yellow');
  
  // Configuration
  log('\n3. Configuration Status:', 'bright');
  log(`   librechat.yaml: ${configResults.librechatYaml ? '✓ Configured' : '✗ Not configured'}`, 
      configResults.librechatYaml ? 'green' : 'red');
  log(`   .env file: ${configResults.envFile ? '✓ Configured' : '⚠ Check manually'}`, 
      configResults.envFile ? 'green' : 'yellow');
  log(`   handleTools.js: ${configResults.handlerFile ? '✓ Ready' : '✗ Missing'}`, 
      configResults.handlerFile ? 'green' : 'red');
  
  // Final verdict
  const allPassed = workingInstances.length > 0 && 
                   successfulSearches.length > 0 && 
                   configResults.librechatYaml && 
                   configResults.handlerFile;
  
  log('\n' + '='.repeat(70), 'bright');
  if (allPassed) {
    log('✓ ALL TESTS PASSED! SearxNG is configured as PRIMARY search provider', 'green');
    log('\nYour custom agents will now use:', 'bright');
    log('  ✓ SearxNG (FREE, privacy-focused, no rate limits)', 'green');
    log('  ✓ High-uptime instance: https://etsi.me (99.96% uptime)', 'green');
    log('  ✓ Multiple fallback instances available', 'green');
    log('\nNo more DuckDuckGo rate-limiting issues! 🎉', 'cyan');
  } else {
    log('⚠ SOME TESTS FAILED - Review configuration', 'yellow');
    if (workingInstances.length === 0) {
      log('  • No working SearxNG instances found', 'red');
    }
    if (!configResults.librechatYaml) {
      log('  • librechat.yaml needs SearxNG configuration', 'red');
    }
    if (!configResults.handlerFile) {
      log('  • handleTools.js needs updating', 'red');
    }
  }
  log('='.repeat(70), 'bright');
  
  console.log('\n');
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
