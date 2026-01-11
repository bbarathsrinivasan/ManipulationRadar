/**
 * JWT authentication utilities
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AuthenticationError } from './errors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

/**
 * Verify JWT token and extract user ID
 */
export async function verifyJWT(token: string): Promise<{ userId: string }> {
  if (!token) {
    throw new AuthenticationError('Missing authorization token');
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.replace(/^Bearer\s+/i, '');

  if (!cleanToken) {
    throw new AuthenticationError('Invalid authorization token format');
  }

  // Create Supabase client with service role key for admin operations
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Verify the JWT token
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(cleanToken);

    if (error || !user) {
      throw new AuthenticationError('Invalid or expired token');
    }

    return { userId: user.id };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Token verification failed');
  }
}

/**
 * Extract JWT from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
