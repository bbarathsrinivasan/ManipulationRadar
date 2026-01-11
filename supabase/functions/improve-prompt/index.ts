/**
 * Supabase Edge Function: improve-prompt
 * 
 * Refines user prompts to be more neutral, evidence-seeking, and non-manipulative
 * using Azure AI Foundry.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Import Azure OpenAI function from verify-manipulation
// Note: This assumes both functions are in the same project
import { callAzureOpenAI } from '../verify-manipulation/azureOpenAI.ts';

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

  try {
    // Parse request body
    let requestBody: unknown;
    try {
      // Try to parse as JSON directly first
      try {
        requestBody = await req.json();
      } catch {
        // If that fails, try reading as text and parsing
        const bodyText = await req.text();
        if (!bodyText || bodyText.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: 'ValidationError', message: 'Request body is empty' }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
              },
            }
          );
        }
        requestBody = JSON.parse(bodyText);
      }
    } catch (error) {
      console.error('JSON parse error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return new Response(
        JSON.stringify({ 
          error: 'ValidationError', 
          message: `Invalid JSON in request body: ${error instanceof Error ? error.message : String(error)}` 
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        }
      );
    }

    // Validate request
    if (!requestBody || typeof requestBody !== 'object') {
      console.error('Invalid request body type:', typeof requestBody);
      return new Response(
        JSON.stringify({ error: 'ValidationError', message: 'Request body must be a JSON object' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        }
      );
    }

    const requestData = requestBody as Record<string, unknown>;
    const originalPrompt = requestData.prompt;

    console.log('Improve Prompt: Request body received', {
      hasPrompt: !!originalPrompt,
      promptType: typeof originalPrompt,
      promptLength: typeof originalPrompt === 'string' ? originalPrompt.length : 0,
    });

    if (!originalPrompt || typeof originalPrompt !== 'string' || originalPrompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'ValidationError', message: 'prompt is required and must be a non-empty string' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        }
      );
    }

    // Truncate prompt if too long (max 2000 chars)
    const prompt = originalPrompt.length > 2000 
      ? originalPrompt.substring(0, 2000) + '...'
      : originalPrompt;

    console.log('Improve Prompt: Request received', {
      promptLength: prompt.length,
    });

    // Build system prompt (compact version)
    const systemPrompt = `You are PromptRefiner. Rewrite prompts to be neutral, evidence-seeking, non-manipulative, calibrated, and verifiable.

Rules:
- Preserve original intent, remove loaded language/praise-baiting
- Add evidence-checking for controversial claims
- Add response requirements: correct errors, avoid flattery, cite sources, state uncertainty, provide counterarguments
- Keep concise

Output ONLY JSON:
{
  "rewritten_prompt": "...",
  "response_requirements": ["req1", "req2"],
  "why_this_is_better": ["bullet1", "bullet2"]
}`;

    // Build user prompt
    const userPrompt = `Rewrite this prompt:\n\n${prompt}\n\nReturn JSON with rewritten_prompt, response_requirements[], and why_this_is_better[].`;

    // Call Azure OpenAI
    let llmResponse: string;
    try {
      llmResponse = await callAzureOpenAI(systemPrompt, userPrompt);
    } catch (error) {
      console.error('Azure OpenAI error:', error);
      return new Response(
        JSON.stringify({
          error: 'AzureOpenAIError',
          message: error instanceof Error ? error.message : 'Failed to improve prompt',
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

    // Parse JSON response
    let parsedResponse: {
      rewritten_prompt?: string;
      response_requirements?: string[];
      why_this_is_better?: string[];
    };

    try {
      // Handle double-encoded JSON
      let jsonText = llmResponse.trim();
      
      // Remove markdown code blocks if present
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
      
      // Handle JSON-encoded string
      if (jsonText.startsWith('"') && jsonText.endsWith('"')) {
        try {
          jsonText = JSON.parse(jsonText);
        } catch {
          jsonText = jsonText.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
        }
      }

      parsedResponse = JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse LLM response as JSON:', error);
      console.error('Raw response:', llmResponse.substring(0, 200));
      
      // Return fallback response
      return new Response(
        JSON.stringify({
          rewritten_prompt: prompt, // Return original if parsing fails
          response_requirements: [
            'Correct factual errors rather than agree',
            'Avoid flattery and persuasion tactics',
            'Cite sources with links for important factual claims',
            'State uncertainty and assumptions',
            'Provide counterarguments and alternatives',
          ],
          why_this_is_better: ['Unable to parse AI response, returning original prompt'],
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

    // Validate and sanitize response
    const rewrittenPrompt = parsedResponse.rewritten_prompt || prompt;
    const responseRequirements = Array.isArray(parsedResponse.response_requirements)
      ? parsedResponse.response_requirements.slice(0, 10).map(r => String(r).substring(0, 200))
      : [];
    const whyBetter = Array.isArray(parsedResponse.why_this_is_better)
      ? parsedResponse.why_this_is_better.slice(0, 10).map(w => String(w).substring(0, 200))
      : [];

    // Build response
    const response = {
      rewritten_prompt: rewrittenPrompt.substring(0, 2000), // Limit length
      response_requirements: responseRequirements,
      why_this_is_better: whyBetter,
      meta: {
        provider: 'azure_openai',
        latency_ms: Date.now() - startTime,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
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

// Serve with error wrapper
serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (error) {
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
