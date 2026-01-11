/**
 * Custom error classes for the verify-manipulation Edge Function
 */

import { corsHeaders } from '../_shared/cors.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AzureOpenAIError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AzureOpenAIError';
    this.statusCode = statusCode;
  }
}

export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Map error to HTTP status code
 */
export function getHttpStatus(error: Error): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof AzureOpenAIError) return error.statusCode || 500;
  if (error instanceof CacheError) return 500;
  return 500;
}

/**
 * Create error response
 */
export function createErrorResponse(error: Error): Response {
  const status = getHttpStatus(error);
  const body = {
    error: error.name,
    message: error.message,
    ...(error instanceof RateLimitError && { retry_after: error.retryAfter }),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...(error instanceof RateLimitError && {
        'Retry-After': error.retryAfter.toString(),
      }),
    },
  });
}
