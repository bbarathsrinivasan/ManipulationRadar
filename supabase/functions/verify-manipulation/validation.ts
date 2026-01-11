/**
 * Request validation and sanitization
 */

import { VerifyRequest, Platform, Sensitivity } from './types.ts';
import { ValidationError } from './errors.ts';

const MAX_ASSISTANT_RESPONSE_LENGTH = 50000;
const MAX_USER_PROMPT_LENGTH = 10000;
const MAX_CONTEXT_ITEMS = 4;
const MAX_CONTEXT_ITEM_LENGTH = 10000;

/**
 * Safely truncate string to max length, preserving word boundaries when possible
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  
  // Try to truncate at word boundary
  const truncated = str.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.9) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Validate and sanitize request body
 */
export function validateRequest(body: unknown): VerifyRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }

  const req = body as Record<string, unknown>;

  // Validate required fields
  if (!req.message_id || typeof req.message_id !== 'string' || req.message_id.trim() === '') {
    throw new ValidationError('message_id is required and must be a non-empty string');
  }

  if (!req.platform || typeof req.platform !== 'string') {
    throw new ValidationError('platform is required and must be a string');
  }

  const platform = req.platform.toLowerCase() as Platform;
  if (!['chatgpt', 'claude', 'other'].includes(platform)) {
    throw new ValidationError('platform must be one of: chatgpt, claude, other');
  }

  if (!req.assistant_response || typeof req.assistant_response !== 'string') {
    throw new ValidationError('assistant_response is required and must be a string');
  }

  // Truncate assistant_response
  const assistantResponse = truncateString(
    req.assistant_response,
    MAX_ASSISTANT_RESPONSE_LENGTH
  );

  // Validate and truncate optional user_prompt
  let userPrompt: string | undefined;
  if (req.user_prompt !== undefined) {
    if (typeof req.user_prompt !== 'string') {
      throw new ValidationError('user_prompt must be a string if provided');
    }
    userPrompt = truncateString(req.user_prompt, MAX_USER_PROMPT_LENGTH);
  }

  // Validate and truncate optional context
  let context: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
  if (req.context !== undefined) {
    if (!Array.isArray(req.context)) {
      throw new ValidationError('context must be an array if provided');
    }

    if (req.context.length > MAX_CONTEXT_ITEMS) {
      throw new ValidationError(`context must have at most ${MAX_CONTEXT_ITEMS} items`);
    }

    context = req.context.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new ValidationError(`context[${index}] must be an object`);
      }

      const ctxItem = item as Record<string, unknown>;

      if (ctxItem.role !== 'user' && ctxItem.role !== 'assistant') {
        throw new ValidationError(`context[${index}].role must be 'user' or 'assistant'`);
      }

      if (typeof ctxItem.content !== 'string') {
        throw new ValidationError(`context[${index}].content must be a string`);
      }

      return {
        role: ctxItem.role as 'user' | 'assistant',
        content: truncateString(ctxItem.content as string, MAX_CONTEXT_ITEM_LENGTH),
      };
    });
  }

  // Validate options
  let options: VerifyRequest['options'];
  if (req.options !== undefined) {
    if (typeof req.options !== 'object' || req.options === null) {
      throw new ValidationError('options must be an object if provided');
    }

    const opts = req.options as Record<string, unknown>;

    options = {};

    if (opts.sensitivity !== undefined) {
      if (typeof opts.sensitivity !== 'string') {
        throw new ValidationError('options.sensitivity must be a string');
      }
      const sensitivity = opts.sensitivity.toLowerCase() as Sensitivity;
      if (!['low', 'medium', 'high'].includes(sensitivity)) {
        throw new ValidationError('options.sensitivity must be one of: low, medium, high');
      }
      options.sensitivity = sensitivity;
    }

    if (opts.return_spans !== undefined) {
      if (typeof opts.return_spans !== 'boolean') {
        throw new ValidationError('options.return_spans must be a boolean');
      }
      options.return_spans = opts.return_spans;
    }

    if (opts.max_suggestions !== undefined) {
      if (typeof opts.max_suggestions !== 'number' || opts.max_suggestions < 0) {
        throw new ValidationError('options.max_suggestions must be a non-negative number');
      }
      options.max_suggestions = opts.max_suggestions;
    }

    if (opts.store_event !== undefined) {
      if (typeof opts.store_event !== 'boolean') {
        throw new ValidationError('options.store_event must be a boolean');
      }
      options.store_event = opts.store_event;
    }
  }

  return {
    message_id: req.message_id.trim(),
    platform,
    user_prompt: userPrompt,
    assistant_response: assistantResponse,
    context,
    options,
  };
}
