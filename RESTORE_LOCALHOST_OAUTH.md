# 🔧 Restore Localhost Google OAuth URLs

## Quick Fix: Add Back Localhost Redirect URI

You accidentally deleted the localhost redirect URI. Here's how to restore it:

---

## Step-by-Step: Restore Localhost URLs

### Step 1: Go to Google Cloud Console

1. Visit: [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to: **APIs & Services** → **Credentials**
4. Click on your **OAuth 2.0 Client ID**

### Step 2: Restore Authorized JavaScript Origins

**Add these URLs:**

```
http://localhost:3000
http://127.0.0.1:3000
```

**Note:** If you're using HTTPS locally (uncommon), also add:
```
https://localhost:3000
```

**Full list should include:**
- `http://localhost:3000` ✅
- `http://127.0.0.1:3000` ✅
- `https://practice2panel-frontend.onrender.com` (your production URL) ✅

### Step 3: Restore Authorized Redirect URIs

**Add these callback URLs:**

```
http://localhost:3000/auth/google/callback
http://127.0.0.1:3000/auth/google/callback
```

**Note:** If you're using HTTPS locally, also add:
```
https://localhost:3000/auth/google/callback
```

**Full list should include:**
- `http://localhost:3000/auth/google/callback` ✅
- `http://127.0.0.1:3000/auth/google/callback` ✅
- `https://practice2panel-frontend.onrender.com/auth/google/callback` (your production URL) ✅

### Step 4: Save Changes

1. Click **"Save"** button
2. Wait 1-2 minutes for changes to take effect

---

## Complete List for Both Sections

### Authorized JavaScript Origins:
```
http://localhost:3000
http://127.0.0.1:3000
https://practice2panel-frontend.onrender.com
```

### Authorized Redirect URIs:
```
http://localhost:3000/auth/google/callback
http://127.0.0.1:3000/auth/google/callback
https://practice2panel-frontend.onrender.com/auth/google/callback
```

---

## Important Notes

### HTTP vs HTTPS for Localhost

**Standard (most common):**
- Use `http://localhost:3000` (without 's')
- React dev server runs on HTTP by default

**If you're using HTTPS locally:**
- You would have `https://localhost:3000`
- Requires SSL certificate setup
- Less common for local development

**Check your setup:**
- If your React app runs on `http://localhost:3000` → Use `http://`
- If your React app runs on `https://localhost:3000` → Use `https://`

---

## Testing After Restore

1. **Start your local frontend:**
   ```bash
   cd frontend
   npm start
   ```

2. **Open:** `http://localhost:3000`

3. **Try Google OAuth:**
   - Click "Sign in with Google"
   - Should redirect to Google login
   - After login, should redirect back to `http://localhost:3000/auth/google/callback`
   - Should work without errors

---

## Troubleshooting

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URI not added correctly  
**Fix:** 
- Double-check the exact URL matches: `http://localhost:3000/auth/google/callback`
- Make sure there are no extra spaces or typos
- Wait 1-2 minutes after saving

### Error: "origin_mismatch"
**Cause:** JavaScript origin not added  
**Fix:** 
- Add `http://localhost:3000` to Authorized JavaScript Origins
- Make sure it matches exactly

### Still not working after adding
**Cause:** Changes not propagated yet  
**Fix:** 
- Wait 2-5 minutes
- Clear browser cache
- Try again

---

## Quick Checklist

- [ ] Added `http://localhost:3000` to Authorized JavaScript Origins
- [ ] Added `http://localhost:3000/auth/google/callback` to Authorized Redirect URIs
- [ ] Kept production URLs (`https://practice2panel-frontend.onrender.com`)
- [ ] Saved changes in Google Cloud Console
- [ ] Waited 1-2 minutes for propagation
- [ ] Tested locally

---

**After restoring, localhost Google OAuth should work again!** ✅

