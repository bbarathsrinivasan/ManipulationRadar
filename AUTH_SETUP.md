# Authentication Setup Guide

## Enable Email Authentication in Supabase

Before users can sign up/sign in, you need to enable email authentication in your Supabase project:

### Steps:

1. **Go to your Supabase Dashboard**
   - Navigate to your project
   - Go to **Authentication** → **Providers**

2. **Enable Email Provider**
   - Find "Email" in the list
   - Toggle it **ON**
   - Configure settings:
     - **Enable email confirmations**: Optional (recommended for production)
     - **Secure email change**: Optional
     - **Double opt-in**: Optional

3. **Configure Email Templates (Optional)**
   - Go to **Authentication** → **Email Templates**
   - Customize the confirmation and password reset emails if needed

4. **Set Site URL (Important)**
   - Go to **Authentication** → **URL Configuration**
   - Add your site URL (can be `chrome-extension://your-extension-id` or a placeholder)
   - Add redirect URLs if needed

### For Development/Testing:

If you want to skip email confirmation for testing:

1. Go to **Authentication** → **Providers** → **Email**
2. Disable **"Enable email confirmations"**
3. Users can sign up and use the extension immediately

### User Flow:

1. User opens extension popup
2. Clicks "Sign Up" or "Sign In"
3. Enters email and password
4. If email confirmation is enabled, user receives email and confirms
5. User can now use the verification feature

### Troubleshooting:

**"Email already registered"**
- User already has an account, use "Sign In" instead

**"Invalid login credentials"**
- Check email and password are correct
- If email confirmation is enabled, make sure user confirmed their email

**"Token expired"**
- User needs to sign in again
- Token is automatically refreshed when possible
