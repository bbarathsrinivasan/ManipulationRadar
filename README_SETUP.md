# Setup Instructions for Manipulation Radar

## Environment Variables (Build Time)

The Supabase URL and anon key are configured at **build time** using environment variables. This is the scalable approach for production.

### 1. Create `.env` file

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### 2. Add your Supabase credentials

Edit `.env` and add your values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**
- Go to your Supabase project dashboard
- Settings → API
- Copy the "Project URL" → `VITE_SUPABASE_URL`
- Copy the "anon" or "public" key → `VITE_SUPABASE_ANON_KEY`

### 3. Build the extension

```bash
npm run build
```

The environment variables will be injected at build time. The built extension in `dist/` will contain your Supabase configuration.

### 4. Load the extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

## Why This Approach?

✅ **Scalable**: One build works for all users  
✅ **Secure**: Anon key is public-safe (protected by RLS)  
✅ **No user setup**: Users don't need to configure backend  
✅ **Production-ready**: Standard approach for Chrome extensions  

## Authentication

Users still need to authenticate to get a JWT token:

1. Open the extension popup
2. Click "Sign In"
3. Follow the authentication flow (or manually set token for now)

The JWT token is stored in `chrome.storage.local` and is user-specific.

## Development

For development, you can also set environment variables directly:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_ANON_KEY=your-key \
npm run build
```

Or use a `.env.local` file (not committed to git).
