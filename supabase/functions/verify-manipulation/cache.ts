/**
 * Caching utilities using Supabase Postgres
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CacheError } from './errors.ts';
import { VerifyResponse } from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CACHE_TTL_HOURS = parseInt(Deno.env.get('CACHE_TTL_HOURS') || '6', 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Generate cache key
 */
function getCacheKey(userId: string, messageId: string, sensitivity: string = 'medium'): string {
  return `${userId}:${messageId}:${sensitivity}`;
}

/**
 * Get cached result
 */
export async function getCache(
  userId: string,
  messageId: string,
  sensitivity: string = 'medium'
): Promise<VerifyResponse | null> {
  const cacheKey = getCacheKey(userId, messageId, sensitivity);

  try {
    const { data, error } = await supabase
      .from('verification_cache')
      .select('result, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" - that's okay
        console.error('Error fetching cache:', error);
      }
      return null;
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired entry
      await supabase
        .from('verification_cache')
        .delete()
        .eq('cache_key', cacheKey);
      return null;
    }

    // Return cached result
    return data.result as VerifyResponse;
  } catch (error) {
    console.error('Unexpected error fetching cache:', error);
    return null; // Fail open - don't block request if cache fails
  }
}

/**
 * Store result in cache
 */
export async function setCache(
  userId: string,
  messageId: string,
  sensitivity: string,
  result: VerifyResponse,
  ttlHours: number = CACHE_TTL_HOURS
): Promise<void> {
  const cacheKey = getCacheKey(userId, messageId, sensitivity);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  try {
    const { error } = await supabase
      .from('verification_cache')
      .upsert({
        cache_key: cacheKey,
        result: result as unknown as Record<string, unknown>,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'cache_key',
      });

    if (error) {
      console.error('Error storing cache:', error);
      // Don't throw - caching is best effort
    }
  } catch (error) {
    console.error('Unexpected error storing cache:', error);
    // Don't throw - caching is best effort
  }
}
