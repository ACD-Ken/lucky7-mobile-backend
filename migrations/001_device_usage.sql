-- Migration 001: device_usage table for run-count gate
-- Run this once in Supabase dashboard SQL editor, OR
-- set DATABASE_URL env var in Railway and it runs automatically on server startup.

CREATE TABLE IF NOT EXISTS device_usage (
  device_id  TEXT        PRIMARY KEY,
  run_count  INTEGER     NOT NULL DEFAULT 0,
  first_run  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
