/**
 * Supabase Edge Function: verify-manipulation
 * 
 * Analyzes AI assistant responses for manipulation patterns and reliability issues
 * using Azure OpenAI.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

import { verifyJWT, extractTokenFromHeader } from './auth.ts';
import { validateRequest } from './validation.ts';
import { checkRateLimit, acquireInFlightLock, releaseInFlightLock } from './rateLimit.ts';
import { getCache, setCache } from './cache.ts';
import { callAzureOpenAI } from './azureOpenAI.ts';
import { buildPrompt } from './prompt.ts';
import { calculateRiskScore, calculateReliabilityLevel } from './scoring.ts';
import { createErrorResponse, AuthenticationError, ValidationError, RateLimitError } from './errors.ts';
import {
  VerifyRequest,
  VerifyResponse,
  AzureOpenAIResponse,
  ManipulationDetection,
} from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const AZURE_OPENAI_BASE_URL = Deno.env.get('AZURE_OPENAI_BASE_URL') || '';
const AZURE_OPENAI_DEPLOYMENT = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-5-nano';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Extract and verify JWT
    const authHeader = req.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return createErrorResponse(new AuthenticationError('Missing authorization header'));
    }

    let userId: string;
    try {
      const authResult = await verifyJWT(token);
      userId = authResult.userId;
    } catch (error) {
      return createErrorResponse(error as Error);
    }

    // Parse request body
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch (error) {
      return createErrorResponse(new ValidationError('Invalid JSON in request body'));
    }

    // Validate request
    let request: VerifyRequest;
    try {
      request = validateRequest(requestBody);
    } catch (error) {
      return createErrorResponse(error as Error);
    }

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
              'Retry-After': String(rateLimitResult.retryAfter || 60),
            },
          }
        );
      }
    } catch (error) {
      return createErrorResponse(error as Error);
    }

    // Check in-flight lock
    const hasLock = await acquireInFlightLock(userId);
    if (!hasLock) {
      return createErrorResponse(
        new RateLimitError('Another analysis is already in progress. Please wait.', 30)
      );
    }

    try {
      // Check cache
      const sensitivity = request.options?.sensitivity || 'medium';
      const cachedResult = await getCache(userId, request.message_id, sensitivity);

      if (cachedResult) {
        // Return cached result
        await releaseInFlightLock(userId);
        const latency = Date.now() - startTime;
        return new Response(
          JSON.stringify({
            ...cachedResult,
            meta: {
              ...cachedResult.meta,
              latency_ms: latency,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Build prompts
      const { systemPrompt, userPrompt } = buildPrompt(request);

      // Call Azure OpenAI
      let llmResponse: string;
      try {
        llmResponse = await callAzureOpenAI(systemPrompt, userPrompt);
      } catch (error) {
        await releaseInFlightLock(userId);
        return createErrorResponse(error as Error);
      }

      // Parse and validate JSON response
      let parsedResponse: AzureOpenAIResponse;
      try {
        // Try to extract JSON from markdown code blocks if present
        let jsonText = llmResponse.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
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
            base_url: AZURE_OPENAI_BASE_URL,
            deployment: AZURE_OPENAI_DEPLOYMENT,
            cached: false,
            latency_ms: Date.now() - startTime,
          },
        };

        return new Response(JSON.stringify(fallbackResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          base_url: AZURE_OPENAI_BASE_URL,
          deployment: AZURE_OPENAI_DEPLOYMENT,
          cached: false,
          latency_ms: Date.now() - startTime,
        },
      };

      // Store in cache
      await setCache(userId, request.message_id, sensitivity, response);

      // Optional event logging
      if (request.options?.store_event) {
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          await supabase.from('verification_events').insert({
            user_id: userId,
            message_id: request.message_id,
            timestamp: new Date().toISOString(),
            platform: request.platform,
            risk_score: riskScore,
            risk_level: riskLevel,
            reliability_score: reliabilityScore,
            reliability_level: reliabilityLevel,
            counts_by_type: countsByType,
            model: AZURE_OPENAI_DEPLOYMENT,
            cached: false,
            latency_ms: response.meta.latency_ms,
          });
        } catch (error) {
          console.error('Error logging event:', error);
          // Don't fail the request if logging fails
        }
      }

      await releaseInFlightLock(userId);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      // Always release lock
      await releaseInFlightLock(userId);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return createErrorResponse(error as Error);
  }
});
