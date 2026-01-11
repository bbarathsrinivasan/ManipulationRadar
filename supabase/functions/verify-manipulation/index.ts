/**
 * Supabase Edge Function: verify-manipulation
 * 
 * Analyzes AI assistant responses for manipulation patterns and reliability issues
 * using Azure OpenAI.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Authentication removed - no JWT verification needed
import { validateRequest } from './validation.ts';
import { checkRateLimit, acquireInFlightLock, releaseInFlightLock } from './rateLimit.ts';
import { getCache, setCache } from './cache.ts';
import { callAzureOpenAI } from './azureOpenAI.ts';
import { buildPrompt } from './prompt.ts';
import { calculateRiskScore, calculateReliabilityLevel } from './scoring.ts';
import { createErrorResponse, ValidationError, RateLimitError } from './errors.ts';
import {
  VerifyRequest,
  VerifyResponse,
  AzureOpenAIResponse,
  ManipulationDetection,
} from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// Azure OpenAI config is now loaded at runtime in azureOpenAI.ts

// Main request handler
async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const startTime = Date.now();

  // Wrap everything in try-catch to ensure CORS headers are always returned
  try {
    // Authentication removed - allow anonymous access
    // Generate a stable anonymous user ID (UUID format) for rate limiting and caching
    // Use a combination of IP and user-agent to create a deterministic UUID
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    // Create a deterministic UUID v5-like string from IP and user agent
    // This ensures same user gets same ID, and it's in valid UUID format for database
    async function generateDeterministicUUID(seed: string): Promise<string> {
      // Use crypto to create a hash
      const encoder = new TextEncoder();
      const data = encoder.encode(seed);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Format as UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // Use first 32 hex chars from hash
      const uuid = `${hashHex.substring(0, 8)}-${hashHex.substring(8, 12)}-4${hashHex.substring(13, 16)}-${(parseInt(hashHex.substring(16, 17), 16) & 0x3 | 0x8).toString(16)}${hashHex.substring(17, 20)}-${hashHex.substring(20, 32)}`;
      return uuid;
    }
    
    const seed = `anon_${forwardedFor.split(',')[0].trim()}_${userAgent}`;
    const userId = await generateDeterministicUUID(seed);
    
    console.log('Manipulation Radar: Request received', {
      method: req.method,
      url: req.url,
      userId: userId.substring(0, 20) + '...',
    });

    // Parse request body
    let requestBody: unknown;
    try {
      const bodyText = await req.text();
      if (!bodyText) {
        return createErrorResponse(new ValidationError('Request body is empty'));
      }
      requestBody = JSON.parse(bodyText);
    } catch (error) {
      console.error('JSON parse error:', error);
      return createErrorResponse(new ValidationError('Invalid JSON in request body'));
    }

    // Validate request
    let request: VerifyRequest;
    try {
      request = validateRequest(requestBody);
    } catch (error) {
      return createErrorResponse(error as Error);
    }
    
    // Log validated request details
    console.log('Manipulation Radar: Request validated', {
      messageId: request.message_id,
      assistantResponseLength: request.assistant_response?.length || 0,
      hasUserPrompt: !!request.user_prompt,
      contextLength: request.context?.length || 0,
    });

    // Check rate limit
    try {
      const rateLimitResult = await checkRateLimit(userId);
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: 'RateLimitError',
            message: `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds`,
            retry_after: rateLimitResult.retryAfter,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Retry-After': String(rateLimitResult.retryAfter || 60),
            },
          }
        );
      }
    } catch (error) {
      return createErrorResponse(error as Error);
    }

    // Check in-flight lock (with error handling)
    try {
      const hasLock = await acquireInFlightLock(userId);
      if (!hasLock) {
        return createErrorResponse(
          new RateLimitError('Another analysis is already in progress. Please wait.', 30)
        );
      }
    } catch (error) {
      console.error('In-flight lock error:', error);
      // Continue anyway - don't block on lock errors
    }

    try {
      // Check cache (with error handling)
      // NOTE: Cache is based on userId + messageId + sensitivity
      // If messageId is not unique per message, cache will return wrong results
      const sensitivity = request.options?.sensitivity || 'medium';
      let cachedResult = null;
      try {
        cachedResult = await getCache(userId, request.message_id, sensitivity);
        if (cachedResult) {
          console.log('Cache hit for message_id:', request.message_id, {
            cacheKey: `${userId}:${request.message_id}:${sensitivity}`,
            cachedResponsePreview: JSON.stringify(cachedResult).substring(0, 100),
          });
        }
      } catch (error) {
        console.error('Cache get error:', error);
        // Continue - cache errors shouldn't block
      }

      if (cachedResult) {
        // Return cached result
        try {
          await releaseInFlightLock(userId);
        } catch (e) {
          // Ignore lock release errors
        }
        const latency = Date.now() - startTime;
        console.log('Returning cached result for message_id:', request.message_id);
        return new Response(
          JSON.stringify({
            ...cachedResult,
            meta: {
              ...cachedResult.meta,
              latency_ms: latency,
              cached: true,
            },
          }),
          {
            status: 200,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
          }
        );
      }
      
      console.log('Cache miss for message_id:', request.message_id, {
        assistantResponsePreview: request.assistant_response.substring(0, 50),
        '- proceeding with analysis': true,
      });

      // Build prompts
      const { systemPrompt, userPrompt } = buildPrompt(request);

      // Call Azure OpenAI
      let llmResponse: string;
      try {
        llmResponse = await callAzureOpenAI(systemPrompt, userPrompt);
      } catch (error) {
        await releaseInFlightLock(userId);
        console.error('Azure OpenAI error:', error);
        // Return error with CORS headers
        const errorResponse = createErrorResponse(error as Error);
        return errorResponse;
      }

      // Parse and validate JSON response
      let parsedResponse: AzureOpenAIResponse;
      try {
        // The response from Azure AI Foundry is already a JSON string
        // Try to extract JSON from markdown code blocks if present (some models wrap it)
        let jsonText = llmResponse.trim();
        
        // Remove markdown code blocks if present
        const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        }
        
        // Remove leading/trailing whitespace and quotes if the response is double-encoded
        jsonText = jsonText.trim();
        if (jsonText.startsWith('"') && jsonText.endsWith('"')) {
          // It's a JSON-encoded string, unescape it
          try {
            jsonText = JSON.parse(jsonText);
          } catch {
            // If parsing fails, try removing quotes manually
            jsonText = jsonText.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
          }
        }

        parsedResponse = JSON.parse(jsonText) as AzureOpenAIResponse;
      } catch (error) {
        console.error('Failed to parse LLM response as JSON:', error);
        console.error('Raw response:', llmResponse);

        // Return safe fallback
        await releaseInFlightLock(userId);
        const fallbackResponse: VerifyResponse = {
          message_id: request.message_id,
          manipulation: {
            risk_score: 0,
            risk_level: 'Low',
            detections: [],
            counts_by_type: {},
          },
          reliability: {
            score: 100,
            level: 'High',
            top_issues: [],
          },
          suggestions: [
            {
              label: 'Request clarification',
              prompt_to_insert: 'Can you provide more details and sources?',
              reason: 'Unable to analyze response automatically',
            },
          ],
          meta: {
            provider: 'azure_openai',
            base_url: Deno.env.get('AZURE_OPENAI_BASE_URL') || 'not-configured',
            deployment: Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'not-configured',
            cached: false,
            latency_ms: Date.now() - startTime,
          },
        };

        return new Response(JSON.stringify(fallbackResponse), {
          status: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        });
      }

      // Validate parsed response structure
      if (!parsedResponse.detections || !Array.isArray(parsedResponse.detections)) {
        parsedResponse.detections = [];
      }

      if (!parsedResponse.reliability || typeof parsedResponse.reliability.score !== 'number') {
        parsedResponse.reliability = {
          score: 100,
          top_issues: [],
        };
      }

      if (!parsedResponse.suggestions || !Array.isArray(parsedResponse.suggestions)) {
        parsedResponse.suggestions = [];
      }

      // Validate and sanitize detections
      const validDetections: ManipulationDetection[] = [];
      for (const detection of parsedResponse.detections) {
        if (
          detection &&
          typeof detection === 'object' &&
          ['sycophancy', 'flattery', 'persuasion', 'emotional', 'authority'].includes(
            detection.type
          ) &&
          typeof detection.severity === 'number' &&
          typeof detection.rationale === 'string'
        ) {
          validDetections.push({
            type: detection.type,
            severity: Math.max(0, Math.min(10, Math.round(detection.severity))),
            rationale: detection.rationale.substring(0, 500), // Limit rationale length
            spans: Array.isArray(detection.spans) ? detection.spans : undefined,
          });
        }
      }

      // Calculate scores
      const { score: riskScore, level: riskLevel, countsByType } = calculateRiskScore(
        validDetections
      );

      const reliabilityScore = Math.max(
        0,
        Math.min(100, Math.round(parsedResponse.reliability.score))
      );
      const reliabilityLevel = calculateReliabilityLevel(reliabilityScore);

      // Limit suggestions
      const maxSuggestions = request.options?.max_suggestions || 5;
      const suggestions = parsedResponse.suggestions
        .slice(0, maxSuggestions)
        .filter(
          (s) =>
            s &&
            typeof s === 'object' &&
            typeof s.label === 'string' &&
            typeof s.prompt_to_insert === 'string' &&
            typeof s.reason === 'string'
        )
        .map((s) => ({
          label: s.label.substring(0, 40),
          prompt_to_insert: s.prompt_to_insert.substring(0, 500),
          reason: s.reason.substring(0, 200),
        }));

      // Build response
      const response: VerifyResponse = {
        message_id: request.message_id,
        manipulation: {
          risk_score: riskScore,
          risk_level: riskLevel,
          detections: validDetections,
          counts_by_type: countsByType,
        },
        reliability: {
          score: reliabilityScore,
          level: reliabilityLevel,
          top_issues: Array.isArray(parsedResponse.reliability.top_issues)
            ? parsedResponse.reliability.top_issues.slice(0, 10).map((s) => String(s).substring(0, 200))
            : [],
        },
        suggestions,
        meta: {
          provider: 'azure_openai',
          base_url: Deno.env.get('AZURE_OPENAI_BASE_URL') || 'not-configured',
          deployment: Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'not-configured',
          cached: false,
          latency_ms: Date.now() - startTime,
        },
      };

      // Store in cache
      await setCache(userId, request.message_id, sensitivity, response);

      // Optional event logging (disabled for anonymous users)
      // Note: Event logging requires user_id which references auth.users
      // For anonymous access, we skip event logging
      // if (request.options?.store_event) {
      //   // Event logging disabled for anonymous access
      // }

      // Release lock (with error handling)
      try {
        await releaseInFlightLock(userId);
      } catch (error) {
        console.error('Lock release error:', error);
        // Continue - lock release errors shouldn't block response
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    } finally {
      // Always try to release lock
      try {
        await releaseInFlightLock(userId);
      } catch (error) {
        // Ignore errors in finally block
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error name:', error instanceof Error ? error.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    
    // Ensure error response has CORS headers - always return proper CORS
    try {
      const errorResponse = createErrorResponse(error as Error);
      return errorResponse;
    } catch (responseError) {
      // Fallback: if createErrorResponse fails, return basic error with CORS
      console.error('Failed to create error response:', responseError);
      return new Response(
        JSON.stringify({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        }
      );
    }
  }
}

// Serve with error wrapper to ensure CORS headers are always returned
serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (error) {
    // Ultimate fallback - ensure CORS headers even if everything fails
    console.error('Fatal error in serve wrapper:', error);
    return new Response(
      JSON.stringify({
        error: 'InternalServerError',
        message: 'A fatal error occurred',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      }
    );
  }
});
