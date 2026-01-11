/**
 * Rate limiting using Supabase Postgres
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RateLimitError, CacheError } from './errors.ts';
import { RateLimitResult } from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REQUESTS_PER_MINUTE = parseInt(
  Deno.env.get('RATE_LIMIT_REQUESTS_PER_MINUTE') || '10',
  10
);
const IN_FLIGHT_LOCK_TTL_SECONDS = 30; // Lock expires after 30 seconds

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Get current rate limit window (minute-based)
 */
function getCurrentWindow(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
}

/**
 * Check rate limit for user
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const windowStart = getCurrentWindow();
  const windowStartStr = windowStart.toISOString();

  try {
    // Check current request count for this window
    const { data: existing, error: selectError } = await supabase
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('user_id', userId)
      .eq('window_start', windowStartStr)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay
      console.error('Error checking rate limit:', selectError);
      throw new CacheError('Failed to check rate limit');
    }

    const currentCount = existing?.request_count || 0;

    if (currentCount >= REQUESTS_PER_MINUTE) {
      // Calculate seconds until next window
      const nextWindow = new Date(windowStart);
      nextWindow.setMinutes(nextWindow.getMinutes() + 1);
      const retryAfter = Math.ceil((nextWindow.getTime() - Date.now()) / 1000);
      
      return {
        allowed: false,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Increment or insert
    if (existing) {
      const { error: updateError } = await supabase
        .from('rate_limit_tracking')
        .update({ request_count: currentCount + 1 })
        .eq('user_id', userId)
        .eq('window_start', windowStartStr);

      if (updateError) {
        console.error('Error updating rate limit:', updateError);
        throw new CacheError('Failed to update rate limit');
      }
    } else {
      const { error: insertError } = await supabase
        .from('rate_limit_tracking')
        .insert({
          user_id: userId,
          window_start: windowStartStr,
          request_count: 1,
        });

      if (insertError) {
        console.error('Error inserting rate limit:', insertError);
        throw new CacheError('Failed to insert rate limit');
      }
    }

    return { allowed: true };
  } catch (error) {
    if (error instanceof CacheError) {
      throw error;
    }
    console.error('Unexpected error in rate limit check:', error);
    throw new CacheError('Rate limit check failed');
  }
}

/**
 * Acquire in-flight lock for user (prevents concurrent analysis)
 */
export async function acquireInFlightLock(userId: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + IN_FLIGHT_LOCK_TTL_SECONDS * 1000);

  try {
    // Try to insert lock
    const { error: insertError } = await supabase
      .from('in_flight_analysis')
      .insert({
        user_id: userId,
        locked_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (!insertError) {
      return true; // Lock acquired
    }

    // If insert failed, check if existing lock is expired
    const { data: existing, error: selectError } = await supabase
      .from('in_flight_analysis')
      .select('expires_at')
      .eq('user_id', userId)
      .single();

    if (selectError) {
      console.error('Error checking in-flight lock:', selectError);
      return false;
    }

    const expiresAtDate = new Date(existing.expires_at);
    if (expiresAtDate < new Date()) {
      // Lock expired, try to update it
      const { error: updateError } = await supabase
        .from('in_flight_analysis')
        .update({
          locked_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', userId);

      return !updateError;
    }

    return false; // Lock is still active
  } catch (error) {
    console.error('Unexpected error acquiring in-flight lock:', error);
    return false;
  }
}

/**
 * Release in-flight lock for user
 */
export async function releaseInFlightLock(userId: string): Promise<void> {
  try {
    await supabase
      .from('in_flight_analysis')
      .delete()
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error releasing in-flight lock:', error);
    // Don't throw - lock will expire anyway
  }
}

/**
 * Check if user has an active in-flight analysis
 */
export async function hasInFlightLock(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('in_flight_analysis')
      .select('expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    const expiresAt = new Date(data.expires_at);
    return expiresAt > new Date();
  } catch (error) {
    console.error('Error checking in-flight lock:', error);
    return false;
  }
}
