# Setup Guide for Manipulation Radar

This guide will help you set up the Manipulation Radar Chrome extension with Supabase Edge Functions and Azure AI Foundry integration.

## Prerequisites

- Node.js 18+ and npm
- Chrome browser
- Supabase account (free tier works)
- Azure AI Foundry account with a deployment

## Step 1: Clone and Install

```bash
git clone <repository-url>
cd ManipulationRadar
npm install
```

## Step 2: Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these values:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "Project URL" → `VITE_SUPABASE_URL`
4. Copy the "anon public" key → `VITE_SUPABASE_ANON_KEY`

## Step 3: Set Up Supabase Database

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Link your project**:
   ```bash
   supabase link --project-ref your-project-id
   ```

3. **Run migrations**:
   ```bash
   supabase db push
   ```

This creates the following tables:
- `verification_events` - Event logging (optional)
- `rate_limit_tracking` - Rate limiting
- `in_flight_analysis` - Burst protection
- `verification_cache` - Result caching

## Step 4: Deploy Edge Functions

1. **Deploy verify-manipulation function**:
   ```bash
   supabase functions deploy verify-manipulation
   ```

2. **Deploy improve-prompt function**:
   ```bash
   supabase functions deploy improve-prompt
   ```

## Step 5: Configure Edge Function Secrets

In your Supabase Dashboard:

1. Go to **Edge Functions** → **Secrets**
2. Add the following secrets:

   ```
   AZURE_OPENAI_API_KEY=your-azure-api-key
   AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/v1/
   AZURE_OPENAI_DEPLOYMENT=gpt-5-nano
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

**Where to find Azure values:**
- **API Key**: Azure Portal → Your AI Foundry resource → Keys and Endpoint
- **Base URL**: Format is `https://{resource-name}.openai.azure.com/openai/v1/`
- **Deployment**: Your deployment name (e.g., `gpt-5-nano`)

**Where to find Supabase values:**
- **SUPABASE_URL**: Same as `VITE_SUPABASE_URL` from Step 2
- **SERVICE_ROLE_KEY**: Supabase Dashboard → Settings → API → "service_role" key (⚠️ Keep this secret!)

## Step 6: Build the Extension

```bash
npm run build
```

This creates a `dist` directory with the compiled extension.

## Step 7: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `dist` directory from your project
5. The extension should now appear in your extensions list

## Step 8: Verify Installation

1. Navigate to `https://chatgpt.com` or `https://claude.ai`
2. You should see the Manipulation Radar sidebar on the right
3. Start a conversation and look for:
   - "🔍 Verify Response" button below AI messages
   - "✨ Improve Prompt" button below your messages
   - Sidebar showing "Online" status

## Troubleshooting

### Extension Not Appearing
- Make sure you're on a supported domain (`chat.openai.com`, `chatgpt.com`, or `claude.ai`)
- Check browser console for errors
- Reload the extension in `chrome://extensions/`

### "Failed to fetch" Errors
- Verify your `.env` file has correct Supabase URL and anon key
- Rebuild the extension: `npm run build`
- Check Supabase Dashboard → Edge Functions → Logs for errors

### "Missing authorization header" Errors
- This should not occur with anonymous access
- If it does, check that Edge Functions are deployed correctly

### Verification Not Working
- Check Supabase Edge Function logs for errors
- Verify Azure AI Foundry secrets are set correctly
- Ensure your Azure deployment is active and accessible

### Rate Limit Errors
- Wait 60 seconds and try again
- Check Supabase Dashboard → Database → Tables → `rate_limit_tracking`

## Environment Variables Summary

### Frontend (`.env` file)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

### Backend (Supabase Dashboard → Edge Functions → Secrets)
- `AZURE_OPENAI_API_KEY` - Azure AI Foundry API key
- `AZURE_OPENAI_BASE_URL` - Azure AI Foundry endpoint URL
- `AZURE_OPENAI_DEPLOYMENT` - Your deployment name
- `SUPABASE_URL` - Your Supabase project URL (same as frontend)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (⚠️ secret!)

## Testing

1. **Test Verification**:
   - Ask ChatGPT/Claude a question
   - Click "🔍 Verify Response" on the AI's response
   - Should see loading animation, then results

2. **Test Prompt Improvement**:
   - Type a message in the input field
   - Click "✨ Improve Prompt" suggestion
   - Or send a message and click the button below it
   - Should see improved prompt with options to insert/copy

3. **Test Sidebar**:
   - Click the icon on the right edge to expand/collapse
   - Drag the collapsed icon to reposition
   - Check verification history appears after verifying messages

## Next Steps

- Customize sensitivity settings in the extension popup
- Review verification history in the sidebar
- Use improved prompts to get better AI responses

## Support

If you encounter issues:
1. Check the browser console (F12) for errors
2. Check Supabase Dashboard → Edge Functions → Logs
3. Verify all environment variables are set correctly
4. Ensure Azure AI Foundry deployment is active

---

**Happy verifying! 🛡️**
