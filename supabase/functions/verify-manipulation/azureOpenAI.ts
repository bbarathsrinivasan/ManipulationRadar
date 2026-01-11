/**
 * Azure OpenAI client
 */

import { AzureOpenAIError } from './errors.ts';

// Get Azure AI Foundry config (check at runtime, not module load)
// This allows the function to deploy even if credentials aren't set yet
function getAzureConfig() {
  const apiKey = Deno.env.get('AZURE_OPENAI_API_KEY') || '';
  const baseUrl = Deno.env.get('AZURE_OPENAI_BASE_URL') || '';
  const deployment = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-5-nano';

  if (!apiKey) {
    throw new Error('AZURE_OPENAI_API_KEY environment variable is required. Set it in Supabase Dashboard → Edge Functions → Secrets.');
  }

  if (!baseUrl) {
    throw new Error('AZURE_OPENAI_BASE_URL environment variable is required. Set it in Supabase Dashboard → Edge Functions → Secrets.');
  }

  // Ensure baseUrl ends with /openai/v1/ (Azure AI Foundry format)
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  return { apiKey, baseUrl: normalizedBaseUrl, deployment };
}

/**
 * Call Azure OpenAI chat completions API
 */
export async function callAzureOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Get config at runtime
  const { apiKey, baseUrl, deployment } = getAzureConfig();
  
  // Azure AI Foundry uses OpenAI-compatible API without api-version parameter
  // Base URL should already include /openai/v1/, so we just append chat/completions
  const url = `${baseUrl}chat/completions`;

  const requestBody = {
    model: deployment,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    max_completion_tokens: 8000, // Increased to handle longer JSON responses with multiple detections
    response_format: {
      type: 'json_object' as const,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Azure OpenAI API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }

      throw new AzureOpenAIError(errorMessage, response.status);
    }

    const data = await response.json();
    
    // Log the full response for debugging (only log structure, not full content to avoid spam)
    console.log('Azure AI Foundry response structure:', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      firstChoice: data.choices?.[0] ? {
        hasMessage: !!data.choices[0].message,
        hasContent: !!data.choices[0].message?.content,
        contentType: typeof data.choices[0].message?.content,
        contentLength: data.choices[0].message?.content?.length || 0,
      } : null,
    });

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('No choices in response:', data);
      throw new AzureOpenAIError('Invalid response from Azure OpenAI: no choices');
    }

    // Try different response formats
    const choice = data.choices[0];
    let content = null;
    
    // Check for content in message.content (standard format)
    if (choice?.message?.content) {
      content = choice.message.content;
    }
    // Check for content directly in choice
    else if (choice?.content) {
      content = choice.content;
    }
    // Check for delta (streaming format)
    else if (choice?.delta?.content) {
      content = choice.delta.content;
    }
    // Check for text (some API formats)
    else if (choice?.text) {
      content = choice.text;
    }

    // Check if response was truncated
    if (choice?.finish_reason === 'length') {
      console.warn('Response was truncated due to token limit. finish_reason: length');
      if (!content || content.trim().length === 0) {
        throw new AzureOpenAIError(
          'Response was truncated due to token limit and no content was generated. ' +
          'Try reducing the input size or increasing max_completion_tokens.'
        );
      }
      // If there's some content, try to parse it anyway (might be partial JSON)
      console.warn('Partial response received, attempting to parse:', content.substring(0, 100));
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      console.error('No content found in response:', {
        choice,
        message: choice?.message,
        delta: choice?.delta,
        finish_reason: choice?.finish_reason,
        fullResponse: JSON.stringify(data).substring(0, 500), // Truncate for logging
      });
      throw new AzureOpenAIError(
        `Invalid response from Azure OpenAI: no content. ` +
        `Finish reason: ${choice?.finish_reason || 'unknown'}. ` +
        `Response structure: ${JSON.stringify(data).substring(0, 200)}`
      );
    }

    // Content is a JSON string, return it as-is (will be parsed in index.ts)
    // Trim whitespace in case there are leading/trailing spaces
    return content.trim();
  } catch (error) {
    if (error instanceof AzureOpenAIError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new AzureOpenAIError(`Network error: ${error.message}`);
    }

    throw new AzureOpenAIError('Unknown error calling Azure OpenAI');
  }
}
