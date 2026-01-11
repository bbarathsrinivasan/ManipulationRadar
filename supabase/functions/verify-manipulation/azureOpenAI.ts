/**
 * Azure OpenAI client
 */

import { AzureOpenAIError } from './errors.ts';

const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY') || '';
const AZURE_OPENAI_BASE_URL = Deno.env.get('AZURE_OPENAI_BASE_URL') || '';
const AZURE_OPENAI_DEPLOYMENT = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-5-nano';
const AZURE_OPENAI_API_VERSION = Deno.env.get('AZURE_OPENAI_API_VERSION') || '2024-02-15-preview';

if (!AZURE_OPENAI_API_KEY) {
  throw new Error('AZURE_OPENAI_API_KEY environment variable is required');
}

if (!AZURE_OPENAI_BASE_URL) {
  throw new Error('AZURE_OPENAI_BASE_URL environment variable is required');
}

/**
 * Call Azure OpenAI chat completions API
 */
export async function callAzureOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `${AZURE_OPENAI_BASE_URL}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const requestBody = {
    model: AZURE_OPENAI_DEPLOYMENT,
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
    temperature: 0.3,
    max_tokens: 2000,
    response_format: {
      type: 'json_object' as const,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': AZURE_OPENAI_API_KEY,
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

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new AzureOpenAIError('Invalid response from Azure OpenAI: no choices');
    }

    const content = data.choices[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      throw new AzureOpenAIError('Invalid response from Azure OpenAI: no content');
    }

    return content;
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
