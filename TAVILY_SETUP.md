# Tavily Search Setup - Best for AI Agents

**Tavily** is specifically designed for AI agents with proper tool calling support.

## Why Tavily?
- ✅ Built specifically for LLM agents (no XML tag issues)
- ✅ Proper tool schema that agents understand
- ✅ No rate limiting like DuckDuckGo
- ✅ Better results than SearxNG
- ✅ Free tier: 1000 searches/month

## Setup Steps:

### 1. Get Free API Key
1. Go to https://app.tavily.com/
2. Sign up (free)
3. Copy your API key

### 2. Add to Render
1. Go to https://dashboard.render.com
2. Select your backend service
3. Go to "Environment" tab
4. Add: `TAVILY_API_KEY` = `your-key-here`
5. Save (auto-redeploys)

### 3. Update librechat.yaml (local)
No changes needed! Tavily works automatically when API key is set.

## That's it!
Tavily will be automatically used by agents when the key is set.
