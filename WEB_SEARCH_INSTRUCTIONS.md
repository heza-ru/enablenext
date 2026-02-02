# Web Search Setup Instructions - Updated 2026

## ⚠️ Important: Enable Web Search Requires API Keys

Enable's web search feature requires **2 FREE API keys** to work:

1. **Search Provider** (Serper - 2,500 free searches/month)
2. **Content Scraper** (Jina - 1,000 free requests/month)

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Get Serper API Key (FREE)

1. Go to: **https://serper.dev**
2. Click "Sign Up" (can use Google account)
3. After login, go to **Dashboard** → **API Keys**
4. Copy your API key
5. Paste in `.env` file:
   ```ini
   SERPER_API_KEY=your_key_here
   ```

**Free Tier:** 2,500 searches per month (no credit card needed!)

---

### Step 2: Get Jina AI API Key (FREE)

1. Go to: **https://jina.ai/reader**
2. Click "Get Started" or "Sign Up"
3. After login, go to **Dashboard** or **API Keys**
4. Copy your API key
5. Paste in `.env` file:
   ```ini
   JINA_API_KEY=your_key_here
   ```

**Free Tier:** 1,000 requests per month (no credit card needed!)

---

### Step 3: Restart Backend

After adding both API keys:

```bash
# Stop current backend (Ctrl+C or kill process)
# Then restart:
npm run backend:dev
```

---

## ✅ What's Already Configured

### In `Enable.yaml`:
```yaml
endpoints:
  agents:
    capabilities: ["execute_code", "file_search", "actions", "tools"]
```

This gives you **4 different tools** in the tools panel:
1. **Execute Code** - Run Python/JavaScript code
2. **File Search** - Search through uploaded files
3. **Actions** - Custom API actions
4. **Tools** - Including web search when API keys are configured

### In `interface` section:
```yaml
interface:
  webSearch: true
  agents:
    use: true
```

---

## 🔍 How to Test

1. **Open:** `http://localhost:3090`
2. **Log in** to your account
3. **Create a new chat**
4. **Click the tools icon** in the chat input area
5. **You should see 4 options:**
   - Execute Code
   - File Search
   - Actions
   - Tools (with web search)

---

## 🆓 Alternative: FREE Search Without API Keys

### Option 1: Search1API (100 free credits, no card needed)

1. Go to: **https://www.search1api.com/**
2. Use in "keyless mode" (no signup required)
3. Configure in `.env`:
   ```ini
   # Search1API (use keyless mode)
   SEARCH1_API_URL=https://api.search1api.com
   ```

### Option 2: Brave Search via MCP Server

Enable supports MCP servers. You can use Brave Search:

1. Configure MCP server in your system
2. Enable in Enable settings
3. No additional API keys needed

**MCP Setup:** https://www.mcpstack.org/use/brave-search

---

## 📊 Current Status

```
✅ Backend:           http://localhost:3080
✅ Frontend:          http://localhost:3090
✅ Enable.yaml:    Configured with 4 agent capabilities
✅ .env:              Placeholders added for API keys
⏳ Web Search:        Waiting for API keys (SERPER + JINA)
```

---

## 🐛 Troubleshooting

### Tools Panel Only Shows "Web Search"?

**Issue:** Only 1 tool instead of 4

**Fix:** The `Enable.yaml` should have all capabilities listed:
```yaml
endpoints:
  agents:
    capabilities: ["execute_code", "file_search", "actions", "tools"]
```

### Chatbot Says "Searching Not Available"?

**Issue:** Missing API keys

**Fix:** Add both required API keys:
1. `SERPER_API_KEY` in `.env`
2. `JINA_API_KEY` in `.env`
3. Restart backend

### Tools Not Showing at All?

**Issue:** Agents not enabled

**Fix:** Check `Enable.yaml` has:
```yaml
interface:
  agents:
    use: true
```

---

## 💡 Recommended Setup

**For FREE web search:**

1. **Use Serper** (2,500/month free) for search
2. **Use Jina AI** (1,000/month free) for scraping
3. **Monitor usage** in their dashboards

**Cost:** $0/month for moderate use

**Upgrade paths if you exceed limits:**
- Serper Pro: $50/month (5,000 searches)
- Jina AI paid plans available
- Google Custom Search: 100 free/day, then paid

---

## 📝 Summary

**To enable all 4 tools + web search:**

1. ✅ `Enable.yaml` configured (DONE)
2. ⏳ Get SERPER_API_KEY (5 min signup)
3. ⏳ Get JINA_API_KEY (5 min signup)
4. ⏳ Add both to `.env` file
5. ⏳ Restart backend
6. ✅ Test in chat interface

**Time needed:** 10-15 minutes
**Cost:** FREE for up to 2,500 searches/month

---

## 🔗 Quick Links

- **Serper (Search):** https://serper.dev
- **Jina AI (Scraping):** https://jina.ai/reader
- **Search1API (Alternative):** https://www.search1api.com/
- **Enable Docs:** https://www.Enable.ai/docs/features/web_search
- **MCP Brave Search:** https://www.mcpstack.org/use/brave-search
