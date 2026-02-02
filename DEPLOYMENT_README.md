# Deployment Documentation

Your project is now configured for split deployment:
- **Backend** → Render (https://enablenext.onrender.com)
- **Frontend** → Vercel (https://enablenext-client.vercel.app)

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **DEPLOYMENT_GUIDE.md** | Complete step-by-step deployment guide |
| **QUICK_DEPLOY_CHECKLIST.md** | Quick checklist for deployment |
| **BUILD_SUCCESS.md** | Build configuration and fixes applied |
| **render.yaml** | Render service configuration |

## 🚀 Quick Start

**First time deploying?**
1. Start with **QUICK_DEPLOY_CHECKLIST.md**
2. Follow each checkbox step-by-step
3. Takes ~45 minutes total

**Need detailed explanation?**
- Read **DEPLOYMENT_GUIDE.md** for complete walkthrough

## 🔧 What's Been Configured

### Backend (Render)
- ✅ API-only mode (no frontend serving)
- ✅ Health check endpoint: `/api/health`
- ✅ CORS configured for Vercel frontend
- ✅ Environment variables ready

### Frontend (Vercel)
- ✅ Vite configured to use `VITE_API_URL`
- ✅ API calls routed to Render backend
- ✅ Environment variables ready
- ✅ Build process fixed

### Code Changes Applied
- ✅ `api/server/index.js` - API-only mode detection
- ✅ `client/vite.config.ts` - Environment variable fix
- ✅ `packages/data-provider/src/api-endpoints.ts` - Backend URL support
- ✅ `packages/data-provider/src/request.ts` - CORS credentials enabled

## 📋 Environment Variables Needed

### Backend (Render)
```bash
MONGO_URI=mongodb+srv://...
DOMAIN_CLIENT=https://enablenext-client.vercel.app
DOMAIN_SERVER=https://enablenext.onrender.com
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
CREDS_KEY=<32-chars>
CREDS_IV=<16-chars>
# Plus AI provider keys
```

### Frontend (Vercel)
```bash
VITE_API_URL=https://enablenext.onrender.com
DOMAIN_CLIENT=https://enablenext-client.vercel.app
NODE_ENV=production
```

## ✅ Deployment Status

- [ ] MongoDB Atlas database created
- [ ] Secrets generated
- [ ] Backend deployed to Render
- [ ] Backend environment variables set
- [ ] Frontend environment variables set in Vercel
- [ ] Frontend deployed to Vercel
- [ ] Both services tested and working

## 🆘 Troubleshooting

**Common Issues:**

1. **API 404 Errors** → Check `VITE_API_URL` in Vercel
2. **CORS Errors** → Verify `DOMAIN_CLIENT` matches exactly
3. **Backend Crashes** → Check Render logs, verify MongoDB URI
4. **Env Vars Not Applied** → Redeploy after setting variables

See **DEPLOYMENT_GUIDE.md** for detailed troubleshooting.

## 💰 Cost Estimate

**Free Tier:**
- Vercel: Free (100GB bandwidth)
- Render: Free (with cold starts)
- MongoDB Atlas: Free (512MB)
- **Total: $0/month**

**Production:**
- Vercel Pro: $20/month
- Render Starter: $7/month
- MongoDB M10: $57/month
- **Total: ~$84/month**

## 🔗 Useful Links

- Render Dashboard: https://dashboard.render.com
- Vercel Dashboard: https://vercel.com/dashboard
- MongoDB Atlas: https://cloud.mongodb.com

---

**Ready to deploy?** Open **QUICK_DEPLOY_CHECKLIST.md** and start! 🚀
