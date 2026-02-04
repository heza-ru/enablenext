# Verify Agent Search Integration

## ✅ How to Test Agent Search Functionality

### Step 1: Start Your Servers
```bash
# Terminal 1: Start backend
npm run backend:dev

# Terminal 2: Start frontend  
npm run frontend:dev
```

### Step 2: Open the App
Navigate to: http://localhost:3090

### Step 3: Create a New Chat
1. Click "New Chat"
2. Click the **tools icon** (🔧) in the chat input area
3. Enable **"Web Search"** toggle
4. You should see the web search is enabled

### Step 4: Test Agent Search Queries

#### Test 1: Current Events
```
What are the latest AI developments in February 2026?
```

**Expected Behavior:**
- Agent automatically calls `web_search` tool
- Searches with SearxNG (FREE)
- Gets results + scraped content
- Provides detailed answer with sources
- Cites URLs properly

#### Test 2: Technical Question
```
What is LibreChat and what are its key features?
```

**Expected Behavior:**
- Agent searches the web
- Scrapes LibreChat website and GitHub
- Provides comprehensive answer with:
  - Feature list
  - Technical details
  - Source citations

#### Test 3: Comparison Query
```
Compare LibreChat vs ChatGPT Plus features
```

**Expected Behavior:**
- Agent performs web search
- Scrapes relevant pages
- Compares features
- Provides structured comparison
- Cites sources for claims

#### Test 4: Recent News
```
Latest news about artificial intelligence regulation
```

**Expected Behavior:**
- Agent searches for recent articles
- Scrapes news content
- Summarizes key points
- Lists sources with dates

---

## 🔍 What to Look For

### In the Chat Response:

✅ **Agent mentions searching**:
```
Let me search for the latest information...
```

✅ **Provides structured answer**:
```
Based on my search results:

1. [Topic]
   Source: [URL]
   [Details from scraped content]

2. [Another topic]
   Source: [URL]
   [More details]
```

✅ **Cites sources**:
```
According to [source], ...
Source: https://example.com
```

✅ **Shows current/recent information**:
- Dates mentioned
- "Latest", "recent", "new" terminology
- 2026 references (if asking about current events)

---

## 🐛 Troubleshooting

### Issue: Web search not in tools menu
**Check**:
1. `librechat.yaml` has `web_search` in capabilities
2. Backend restarted after config changes
3. Frontend hard-refreshed (Ctrl+Shift+R)

**Verify in librechat.yaml**:
```yaml
endpoints:
  agents:
    capabilities:
      - execute_code
      - file_search
      - web_search  # ← Must be here!
      - actions
      - tools
```

### Issue: Agent says "cannot search"
**Check backend logs** for errors:
```bash
# Look for:
[loadTools] Web search auth result
[DuckDuckGoSearch] Searching for: ...
[WebScraper] Fetching: ...
```

**Common causes**:
1. SearxNG instance down → Try different instance
2. Network/firewall blocking requests
3. Search provider not configured

### Issue: Agent searches but provides shallow answers
**Cause**: Scraping might be disabled or failing

**Check backend logs** for:
```
[DuckDuckGoSearch] Scraping top 3 results for full content
[WebScraper] Scraped X chars from: [URL]
```

**Solution**: Verify scraping is enabled in `DuckDuckGoSearch.js`:
```javascript
this.enableScraping = true;  // Should be true
this.scrapeTopN = 3;         // Number of results to scrape
```

### Issue: Slow responses
**Expected**: Search + scraping takes 5-10 seconds
- Search: 1-3 seconds
- Scraping 3 URLs: 3-6 seconds
- Agent processing: 1-2 seconds

**If slower than 15 seconds**:
1. Try different SearxNG instance
2. Reduce `scrapeTopN` to 2
3. Increase timeouts

---

## 📊 Backend Logs to Monitor

### Successful Search Flow:

```log
[loadTools] Web search auth result: {
  authenticated: true,
  hasSearchProvider: true,
  searchProvider: 'searxng',
  searxngUrl: 'https://etsi.me'
}

[loadTools] Creating web search tool with config: {
  searchProvider: 'searxng',
  searxngInstanceUrl: 'https://etsi.me',
  hasCallbacks: true
}

[DuckDuckGoSearch] Searching for: latest AI developments 2026

[DuckDuckGoSearch] Found 5 results

[DuckDuckGoSearch] Scraping top 3 results for full content

[WebScraper] Fetching: https://example.com/article1
[WebScraper] Scraped 15000 chars from: https://example.com/article1

[WebScraper] Fetching: https://example.com/article2
[WebScraper] Scraped 20000 chars from: https://example.com/article2

[DuckDuckGoSearch] Content scraping completed
```

### What Each Log Means:

1. **Web search auth result** → Configuration loaded successfully
2. **Creating web search tool** → Tool initialized
3. **Searching for** → Agent called search tool
4. **Found X results** → Search completed
5. **Scraping top X results** → Starting content extraction
6. **Scraped X chars** → Successfully extracted page content
7. **Content scraping completed** → All done!

---

## ✅ Success Criteria

Your web search is working correctly if:

1. ✅ **Web Search appears** in tools menu
2. ✅ **Agent can enable** web search
3. ✅ **Agent automatically searches** when needed
4. ✅ **Agent gets search results** (5 results)
5. ✅ **Agent gets scraped content** (top 3 URLs)
6. ✅ **Agent provides detailed answers** with sources
7. ✅ **Agent cites URLs** properly
8. ✅ **Responses are accurate** and current

---

## 🎯 Example Successful Interaction

**User**: "What is LibreChat?"

**Agent Response** (should look similar to):
```
LibreChat is an open-source AI chat platform that provides a unified interface 
for multiple AI models. Based on my search results:

**Key Features:**
- Multi-model support (GPT-4, Claude, Gemini, etc.)
- Advanced conversation management with bookmarks
- Custom endpoints and presets
- Built-in code execution and file search
- Web search capabilities (which I'm using right now!)
- Open-source and self-hostable

**Sources:**
1. LibreChat Official Website: https://www.librechat.ai
2. GitHub Repository: https://github.com/danny-avila/LibreChat

The platform is actively maintained and includes features like conversation 
branching, AI agents, and extensive customization options.
```

**What to notice**:
- ✅ Detailed information (from scraped content, not just snippets)
- ✅ Structured format (headers, lists)
- ✅ Multiple sources cited
- ✅ URLs provided
- ✅ Accurate, current information

---

## 🔧 Advanced Verification

### Check Tool is Loaded:

Open browser DevTools (F12) → Network tab → Send a message with web search enabled

Look for API calls to:
- `/api/agents/...` or similar
- Response should include tool call data

### Verify Scraped Content:

Check backend logs for:
```
full_content: "[LONG TEXT HERE]"
content_length: 15000
```

If you see these, scraping is working!

### Test Raw Tool Call:

In your backend console or logs, you should see the full tool response:
```json
{
  "query": "user query",
  "results": [
    {
      "position": 1,
      "title": "...",
      "url": "...",
      "snippet": "...",
      "full_content": "...",  ← This means scraping worked!
      "content_length": 15000
    }
  ],
  "provider": "DuckDuckGo (FREE with content scraping)",
  "scraped": true  ← This should be true
}
```

---

## 📝 Quick Test Checklist

Run through these quickly:

- [ ] Web search tool appears in tools menu
- [ ] Can enable web search in a chat
- [ ] Ask: "What is LibreChat?"
- [ ] Agent searches (mentions searching)
- [ ] Agent provides detailed answer
- [ ] Agent cites sources with URLs
- [ ] Answer is accurate and current
- [ ] Backend logs show scraping activity
- [ ] Response time is reasonable (5-15 seconds)

If all checked: **✅ Web search is fully functional!**

---

## 🎉 You're Ready!

Your agents can now:
- 🔍 Search the web with SearxNG (FREE)
- 📄 Scrape full content from web pages (FREE)
- 🤖 Provide detailed, sourced answers
- 📚 Access current information
- 🌐 Cite sources properly

**No API keys needed! Everything is FREE!**

Enjoy your enhanced LibreChat with full web search and content scraping! 🚀
