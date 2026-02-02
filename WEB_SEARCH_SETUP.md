# Web Search Configuration - FREE by Default! 🎉

## ✅ What's Already Configured

Your app now has **FREE web search enabled** and working immediately - no API keys needed!

---

## 🔍 Current Configuration

### **Default Provider: SearxNG (FREE)**
- **URL**: `https://searx.be`
- **API Key**: ❌ Not needed!
- **Cost**: 💰 Free forever
- **Status**: ✅ Working now

### **Alternative Free Instances** (if primary is slow)
Just change `SEARXNG_INSTANCE_URL` in `.env` to:
- `https://searx.work`
- `https://search.bus-hit.me`
- `https://searx.info`
- `https://search.sapti.me`

---

## 🚀 How It Works

1. **Web search is enabled by default** in `Enable.yaml`
2. **Toggle is available** in the chat interface for users
3. **No setup required** - uses free public SearxNG instance
4. **Automatic fallback** if search fails
5. **Safe search** enabled (moderate filtering)

---

## 📋 Configuration Files

### 1. `.env` File
```ini
# FREE Web Search using SearxNG
SEARXNG_INSTANCE_URL=https://searx.be
```

### 2. `Enable.yaml` File
```yaml
interface:
  webSearch: true

webSearch:
  searchProvider: searxng
  searxngInstanceUrl: ${SEARXNG_INSTANCE_URL:-https://searx.be}
  safeSearch: 1
  resultsPerPage: 5
```

---

## 🎯 Premium Options (Optional)

If you want **more accurate results** or **faster speeds**, you can optionally upgrade to:

### **Option 1: Google Search** (Most Accurate)
1. Get API key: https://console.cloud.google.com/apis/credentials
2. Get CSE ID: https://programmablesearchengine.google.com/
3. Update `.env`:
   ```ini
   GOOGLE_SEARCH_API_KEY=your_key_here
   GOOGLE_CSE_ID=your_cse_id_here
   ```
4. Update `Enable.yaml`:
   ```yaml
   webSearch:
     searchProvider: google
     googleSearchApiKey: ${GOOGLE_SEARCH_API_KEY}
     googleCSEId: ${GOOGLE_CSE_ID}
   ```

### **Option 2: Serper API** (Easy Setup)
1. Sign up at: https://serper.dev (free tier: 2,500 queries/month)
2. Get API key from dashboard
3. Update `.env`:
   ```ini
   SERPER_API_KEY=your_key_here
   ```
4. Update `Enable.yaml`:
   ```yaml
   webSearch:
     searchProvider: serper
     serperApiKey: ${SERPER_API_KEY}
   ```

### **Option 3: DuckDuckGo** (Free, Built-in)
No API key needed! Just update `Enable.yaml`:
```yaml
webSearch:
  searchProvider: duckduckgo
```

---

## 🔧 Settings & Toggles

### **Where to Find Settings**
1. Open the app at `http://localhost:3090`
2. Log in to your account
3. Look for the **search toggle** in the chat interface
4. Users can turn web search on/off as needed

### **User Control**
- ✅ Enabled by default (based on query context)
- ✅ Manual toggle available in chat
- ✅ Per-conversation setting
- ✅ Remembers user preference

---

## 📊 What You'll See

When web search is working:
1. User asks a question that needs current info
2. AI automatically searches the web (if enabled)
3. Results are incorporated into the response
4. Sources are cited in the answer

---

## ⚙️ Advanced Settings

### **Customize Search Behavior**

In `Enable.yaml`:
```yaml
webSearch:
  searchProvider: searxng
  searxngInstanceUrl: https://searx.be
  
  # Safe search: 0=off, 1=moderate, 2=strict
  safeSearch: 1
  
  # Number of results per search
  resultsPerPage: 5
  
  # Timeout for search requests (ms)
  timeout: 5000
```

---

## 🐛 Troubleshooting

### **Search Not Working?**

1. **Check backend logs** for search errors
2. **Try alternative SearxNG instance**:
   ```ini
   SEARXNG_INSTANCE_URL=https://searx.work
   ```
3. **Verify Enable.yaml** has correct syntax
4. **Restart backend** after config changes:
   ```bash
   npm run backend:dev
   ```

### **Search Too Slow?**

1. **Use faster SearxNG instance**
2. **Reduce results**: `resultsPerPage: 3`
3. **Upgrade to premium provider** (Google/Serper)

### **Search Results Poor Quality?**

1. **Try Google Search** (best quality)
2. **Try Serper API** (good balance)
3. **Adjust safe search**: `safeSearch: 0`

---

## ✨ Summary

- ✅ **FREE web search** working immediately
- ✅ **No API keys** required for default setup
- ✅ **User toggles** available in interface
- ✅ **Premium options** available if needed
- ✅ **Easy to switch** providers anytime

**Your web search is configured and ready to use!** 🎉

---

## 🔗 Useful Links

- **SearxNG Instances**: https://searx.space/
- **Google Custom Search**: https://programmablesearchengine.google.com/
- **Serper API**: https://serper.dev
- **Enable Docs**: https://www.Enable.ai/docs/configuration/Enable_yaml/web_search
