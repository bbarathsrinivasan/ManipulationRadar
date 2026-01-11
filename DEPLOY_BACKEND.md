# Deploy Backend Changes

The backend Edge Function has been updated to remove authentication. You need to redeploy it to Supabase.

## Deploy Steps

1. **Make sure you're in the project directory:**
   ```bash
   cd "/Users/barathsrinivasanbasavaraj/Desktop/Carnegie Mellon University/CASI/ManipulationRadar"
   ```

2. **Deploy the Edge Function:**
   ```bash
   supabase functions deploy verify-manipulation
   ```

   Or if you're using the Supabase CLI from a different location:
   ```bash
   npx supabase functions deploy verify-manipulation
   ```

3. **Verify deployment:**
   - Check the Supabase dashboard → Edge Functions
   - The function should show as "Active"
   - Test it by clicking "🔍 Verify Response" in the extension

## What Changed

- ✅ Removed JWT authentication requirement
- ✅ Allows anonymous access
- ✅ Uses IP-based user ID for rate limiting
- ✅ Event logging disabled for anonymous users

## Troubleshooting

If you still get "Missing authorization header" error:

1. **Check deployment status:**
   ```bash
   supabase functions list
   ```

2. **View function logs:**
   ```bash
   supabase functions logs verify-manipulation
   ```

3. **Redeploy if needed:**
   ```bash
   supabase functions deploy verify-manipulation --no-verify-jwt
   ```

## Alternative: Manual Deployment

If CLI doesn't work, you can manually update the function in Supabase Dashboard:

1. Go to Supabase Dashboard → Edge Functions
2. Click on `verify-manipulation`
3. Copy the updated code from `supabase/functions/verify-manipulation/index.ts`
4. Paste and deploy
