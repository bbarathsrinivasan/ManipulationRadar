-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verification events table
CREATE TABLE IF NOT EXISTS verification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform TEXT NOT NULL CHECK (platform IN ('chatgpt', 'claude', 'other')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
  reliability_score INTEGER NOT NULL CHECK (reliability_score >= 0 AND reliability_score <= 100),
  reliability_level TEXT NOT NULL CHECK (reliability_level IN ('High', 'Caution', 'Low', 'Unreliable')),
  counts_by_type JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  cached BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_verification_events_user_id ON verification_events(user_id);
CREATE INDEX idx_verification_events_message_id ON verification_events(message_id);
CREATE INDEX idx_verification_events_timestamp ON verification_events(timestamp DESC);

-- RLS Policies
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own events
CREATE POLICY "Users can view own events"
  ON verification_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (for Edge Function)
CREATE POLICY "Service role can insert events"
  ON verification_events
  FOR INSERT
  WITH CHECK (true);

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  user_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

-- Index for cleanup queries
CREATE INDEX idx_rate_limit_tracking_window_start ON rate_limit_tracking(window_start);

-- In-flight analysis lock table
CREATE TABLE IF NOT EXISTS in_flight_analysis (
  user_id UUID PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for cleanup
CREATE INDEX idx_in_flight_analysis_expires_at ON in_flight_analysis(expires_at);

-- Verification cache table
CREATE TABLE IF NOT EXISTS verification_cache (
  cache_key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX idx_verification_cache_expires_at ON verification_cache(expires_at);

-- Function to clean up expired cache entries (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_cache WHERE expires_at < NOW();
  DELETE FROM rate_limit_tracking WHERE window_start < NOW() - INTERVAL '1 hour';
  DELETE FROM in_flight_analysis WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
