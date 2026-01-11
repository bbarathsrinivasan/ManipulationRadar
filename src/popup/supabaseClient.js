/**
 * Supabase client for popup authentication
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false, // We'll handle session storage manually
    detectSessionInUrl: false,
  },
});

/**
 * Get current session and store token
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session && session.access_token) {
    // Store token in Chrome storage
    await chrome.storage.local.set({ supabaseToken: session.access_token });
    return session;
  }
  
  return null;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (data.session && data.session.access_token) {
    // Store token in Chrome storage
    await chrome.storage.local.set({ supabaseToken: data.session.access_token });
  }

  return data;
}

/**
 * Sign up with email and password
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  // If session is created immediately (email confirmation disabled)
  if (data.session && data.session.access_token) {
    await chrome.storage.local.set({ supabaseToken: data.session.access_token });
  }

  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  await supabase.auth.signOut();
  await chrome.storage.local.remove(['supabaseToken']);
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}
