# Supabase Backend for Manipulation Radar

This directory contains the Supabase Edge Function backend for the Manipulation Radar Chrome extension.

## Structure

```
supabase/
├── functions/
│   ├── _shared/
│   │   └── cors.ts              # CORS headers
│   └── verify-manipulation/
│       ├── index.ts             # Main Edge Function handler
│       ├── types.ts             # TypeScript type definitions
│       ├── auth.ts              # JWT verification
│       ├── validation.ts        # Request validation
│       ├── rateLimit.ts         # Rate limiting logic
│       ├── cache.ts             # Caching utilities
│       ├── azureOpenAI.ts       # Azure OpenAI client
│       ├── prompt.ts            # LLM prompt templates
│       ├── scoring.ts           # Score calculation
│       └── errors.ts            # Error handling
├── migrations/
│   └── 20241201000000_verification_events.sql  # Database schema
└── .env.example                 # Environment variables template
```

## Setup

### 1. Database Migration

Run the migration to create the required tables:

```bash
supabase migration up
```

Or apply the migration manually in your Supabase dashboard SQL editor.

### 2. Environment Variables

Set the following environment variables in your Supabase project settings (Edge Functions secrets):

- `AZURE_OPENAI_API_KEY` - Your Azure OpenAI API key
- `AZURE_OPENAI_BASE_URL` - Azure OpenAI endpoint (e.g., `https://your-resource.openai.azure.com/openai/v1/`)
- `AZURE_OPENAI_DEPLOYMENT` - Deployment name (e.g., `gpt-5-nano`)
- `AZURE_OPENAI_API_VERSION` - API version (e.g., `2024-02-15-preview`)
- `SUPABASE_URL` - Your Supabase project URL (automatically available)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (automatically available)

Optional:
- `RATE_LIMIT_REQUESTS_PER_MINUTE` - Default: 10
- `CACHE_TTL_HOURS` - Default: 6

### 3. Deploy Edge Function

```bash
supabase functions deploy verify-manipulation
```

## API Endpoint

**POST** `/functions/v1/verify-manipulation`

### Headers

- `Authorization: Bearer <jwt_token>` - Required. Supabase JWT token.

### Request Body

```json
{
  "message_id": "unique-message-id",
  "platform": "chatgpt" | "claude" | "other",
  "user_prompt": "optional user prompt",
  "assistant_response": "AI assistant response to analyze",
  "context": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "options": {
    "sensitivity": "low" | "medium" | "high",
    "return_spans": true,
    "max_suggestions": 5,
    "store_event": false
  }
}
```

### Response

```json
{
  "message_id": "...",
  "manipulation": {
    "risk_score": 0-100,
    "risk_level": "Low" | "Medium" | "High" | "Critical",
    "detections": [
      {
        "type": "persuasion",
        "severity": 7,
        "rationale": "...",
        "spans": [[120, 164]]
      }
    ],
    "counts_by_type": {
      "sycophancy": 1,
      "persuasion": 1
    }
  },
  "reliability": {
    "score": 0-100,
    "level": "High" | "Caution" | "Low" | "Unreliable",
    "top_issues": ["Authority claim without citation"]
  },
  "suggestions": [
    {
      "label": "Cite sources",
      "prompt_to_insert": "...",
      "reason": "..."
    }
  ],
  "meta": {
    "provider": "azure_openai",
    "base_url": "...",
    "deployment": "...",
    "cached": false,
    "latency_ms": 1234
  }
}
```

## Features

- **JWT Authentication**: All requests require valid Supabase JWT
- **Rate Limiting**: 10 requests per minute per user (configurable)
- **In-Flight Lock**: Prevents concurrent analysis for the same user
- **Caching**: Results cached for 6 hours (configurable)
- **Payload Truncation**: Automatically truncates large inputs
- **Error Handling**: Comprehensive error responses with proper HTTP status codes
- **Event Logging**: Optional logging to `verification_events` table

## Error Responses

- `400` - Validation error (invalid request)
- `401` - Authentication error (missing/invalid JWT)
- `429` - Rate limit exceeded (includes `Retry-After` header)
- `500` - Internal server error

## Database Tables

- `verification_events` - Optional event logging (RLS enabled)
- `rate_limit_tracking` - Rate limit tracking
- `in_flight_analysis` - In-flight lock tracking
- `verification_cache` - Result caching

## Testing

You can test the function locally using `supabase functions serve` or deploy and test via the Supabase dashboard.

Example curl command:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/verify-manipulation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "test-123",
    "platform": "chatgpt",
    "assistant_response": "This is a test response."
  }'
```
