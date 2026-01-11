/**
 * Supabase configuration
 * 
 * These values are PUBLIC and safe to include in the extension.
 * The anon key is protected by Row Level Security (RLS) policies.
 * 
 * For production, set these as environment variables:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * 
 * They will be injected at build time by Vite.
 */

// Use environment variables if available (set at build time)
// Fallback to empty strings - will show error if not configured
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate configuration
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Manipulation Radar: Supabase not configured. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables before building.'
  );
}
