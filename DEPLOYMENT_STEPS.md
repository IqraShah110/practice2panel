# 🚀 Complete Deployment Steps - Practice2Panel

## Current Status ✅
- ✅ Backend deployed: `https://practice2panel-7bj2.onrender.com`
- ✅ Backend is working (API responding)
- ⏳ Frontend needs deployment
- ⏳ Google OAuth needs configuration

---

## Step 1: Update Backend for Production Frontend URL

### Update `Backend/auth.py` - Add production frontend URL

In `auth.py` around line 687-692, update `allowed_frontend_origins`:

```python
allowed_frontend_origins = {
    FRONTEND_URL.rstrip('/'),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://practice2panel-frontend.onrender.com'  # Add this after frontend is deployed
}
```

**Note:** We'll add the exact frontend URL after Step 2.

---

## Step 2: Deploy Frontend on Render

### 2.1 Create Static Site on Render

1. **Render Dashboard** → "New +" → **"Static Site"**
2. **Connect GitHub** repository
3. **Settings:**
   - **Name**: `practice2panel-frontend`
   - **Branch**: `main`
   - **Root Directory**: (leave empty or `frontend`)
   - **Build Command**: 
     ```
     cd frontend && npm install && npm run build
     ```
   - **Publish Directory**: 
     ```
     frontend/build
     ```

### 2.2 Add Environment Variable

**Environment Variable:**
- **Key**: `REACT_APP_API_URL`
- **Value**: `https://practice2panel-7bj2.onrender.com`

### 2.3 Deploy

Click "Create Static Site" and wait for deployment.

**Note the frontend URL** (will be like: `https://practice2panel-frontend.onrender.com`)

---

## Step 3: Update Google OAuth Configuration

### 3.1 Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Click on your **OAuth 2.0 Client ID**

### 3.2 Update Authorized JavaScript Origins

Add:
```
https://practice2panel-frontend.onrender.com
```

### 3.3 Update Authorized Redirect URIs

Add:
```
https://practice2panel-frontend.onrender.com/auth/google/callback
```

**Keep existing localhost URIs** for local development.

### 3.4 Save Changes

---

## Step 4: Update Backend Environment Variables

### 4.1 Render Dashboard → Backend Service → Environment

Add/Update:
- **FRONTEND_URL**: `https://practice2panel-frontend.onrender.com`
- **GOOGLE_CLIENT_ID**: (your existing client ID)
- **GOOGLE_CLIENT_SECRET**: (your existing client secret)

### 4.2 Update Backend Code

Update `Backend/auth.py` to include production frontend URL in `allowed_frontend_origins`.

---

## Step 5: Test Everything

### 5.1 Test Backend
- ✅ `https://practice2panel-7bj2.onrender.com/api/health`
- ✅ `https://practice2panel-7bj2.onrender.com/`

### 5.2 Test Frontend
- Open: `https://practice2panel-frontend.onrender.com`
- Test login/signup
- Test Google OAuth

### 5.3 Test API Connection
- Frontend should connect to backend API
- Check browser console for errors

---

## Quick Checklist

- [ ] Frontend deployed on Render
- [ ] Frontend URL noted
- [ ] Google OAuth redirect URI updated
- [ ] Backend FRONTEND_URL environment variable set
- [ ] Backend auth.py updated with production frontend URL
- [ ] All services tested

---

**Let's start with Step 2 - Deploy Frontend!** 🚀

