-- ============================================================
-- SeeWhy LIVE — fanout_events migration
-- Run in Supabase SQL Editor on project rxlgywvfclyjdfyvfvyc
-- ============================================================

CREATE TABLE IF NOT EXISTS fanout_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   UUID        NOT NULL REFERENCES streams(id)  ON DELETE CASCADE,
  creator_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform    TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','sent','failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fanout_events_stream_id  ON fanout_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_fanout_events_creator_id ON fanout_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_fanout_events_platform   ON fanout_events(platform);
CREATE INDEX IF NOT EXISTS idx_fanout_events_status     ON fanout_events(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_fanout_events_created_at ON fanout_events(created_at DESC);

ALTER TABLE fanout_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_owns_fanout_events" ON fanout_events;
DROP POLICY IF EXISTS "service_role_all"           ON fanout_events;

CREATE POLICY "creator_owns_fanout_events" ON fanout_events FOR ALL
  USING (creator_id = auth.uid());
CREATE POLICY "service_role_all" ON fanout_events FOR ALL
  TO service_role USING (true);

CREATE OR REPLACE VIEW pending_social_announcements AS
  SELECT
    fe.id,
    fe.stream_id,
    fe.creator_id,
    fe.platform,
    fe.event_type,
    fe.payload,
    fe.created_at,
    s.title      AS stream_title,
    p.username   AS creator_handle,
    p.display_name AS creator_name
  FROM  fanout_events fe
  JOIN  streams  s ON s.id = fe.stream_id
  JOIN  profiles p ON p.id = fe.creator_id
  WHERE fe.status = 'pending'
  ORDER BY fe.created_at ASC;

-- Add lumaEventId column to streams if it doesn't exist
ALTER TABLE streams ADD COLUMN IF NOT EXISTS luma_event_id TEXT;
