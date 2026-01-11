# Troubleshooting "Failed to fetch" Error

## Common Causes

### 1. Supabase URL/Key Not Configured

**Check:**
- Open browser console (F12)
- Look for: `Manipulation Radar: Supabase not configured`
- Check the error message for configuration status

**Fix:**
1. Create `.env` file in project root:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
2. Rebuild: `npm run build`
3. Reload extension in Chrome

### 2. CORS Issues

**Check:**
- Browser console shows CORS error
- Network tab shows preflight (OPTIONS) request failing

**Fix:**
- CORS headers are already configured in the backend
- Make sure the function is deployed: `supabase functions deploy verify-manipulation`

### 3. Network/Firewall Issues

**Check:**
- Browser console shows network error
- Check if you can access your Supabase dashboard

**Fix:**
- Check internet connection
- Check if Supabase is accessible from your network
- Try accessing the function URL directly in browser

### 4. Function Not Deployed

**Check:**
- Go to Supabase Dashboard → Edge Functions
- Verify `verify-manipulation` is listed and shows "Active"

**Fix:**
```bash
supabase functions deploy verify-manipulation
```

### 5. Wrong Supabase URL Format

**Check:**
- URL should be: `https://your-project-id.supabase.co`
- NOT: `https://your-project-id.supabase.co/` (no trailing slash)
- NOT: `https://app.supabase.com/project/...`

**Fix:**
- Get correct URL from Supabase Dashboard → Settings → API → Project URL

## Debug Steps

1. **Check Browser Console:**
   - Open F12 → Console tab
   - Look for "Manipulation Radar:" messages
   - Check for detailed error messages

2. **Check Network Tab:**
   - Open F12 → Network tab
   - Click "Verify Response" button
   - Look for the request to `verify-manipulation`
   - Check status code and response

3. **Verify Configuration:**
   ```bash
   # Check .env file exists and has values
   cat .env
   
   # Rebuild to ensure env vars are loaded
   npm run build
   ```

4. **Test Function Directly:**
   - Go to Supabase Dashboard → Edge Functions → verify-manipulation
   - Click "Invoke" or use the test interface
   - See if function works there

## Quick Test

Run this in browser console on ChatGPT/Claude page:

```javascript
// Check if config is loaded
console.log('Supabase URL:', window.location.href);
// The extension logs will show in console when you click Verify
```

## Still Not Working?

1. Check Supabase Dashboard → Edge Functions → verify-manipulation → Logs
2. Look for errors in the function logs
3. Verify Azure OpenAI credentials are set in Supabase secrets
4. Check function is deployed and active
