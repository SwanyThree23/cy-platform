-- ============================================================
-- SeeWhy Live — Additions Schema
-- Run in Supabase SQL Editor AFTER supabase-schema.sql
-- ============================================================

-- ── Polls ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS polls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  question    text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text     text NOT NULL,
  votes    int  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id  uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

-- RPC to safely increment vote count
CREATE OR REPLACE FUNCTION increment_poll_option_votes(p_option_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE poll_options SET votes = votes + 1 WHERE id = p_option_id;
$$;

ALTER TABLE polls       ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes  ENABLE ROW LEVEL SECURITY;

-- Polls: readable by anyone, writable by stream owner
CREATE POLICY "polls_select" ON polls FOR SELECT USING (true);
CREATE POLICY "poll_options_select" ON poll_options FOR SELECT USING (true);
CREATE POLICY "poll_votes_insert" ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "poll_votes_select" ON poll_votes FOR SELECT USING (auth.uid() = user_id);

-- ── Activity Feed ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_feed (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id  uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'post',   -- 'post' | 'poll_results' | 'milestone'
  content    text NOT NULL,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON activity_feed FOR SELECT USING (true);

-- ── Banned Users ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banned_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id  uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text,
  banned_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream_id, user_id)
);

ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banned_select" ON banned_users FOR SELECT USING (true);

-- ── Webhook Endpoints ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url        text NOT NULL,
  secret     text NOT NULL,
  events     text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_select" ON webhook_endpoints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "webhooks_insert" ON webhook_endpoints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "webhooks_delete" ON webhook_endpoints FOR DELETE USING (auth.uid() = user_id);

-- ── Video Posts ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            text NOT NULL DEFAULT 'Video Post',
  video_url        text NOT NULL,
  duration_seconds int  NOT NULL DEFAULT 0,
  views            int  NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE video_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_posts_select" ON video_posts FOR SELECT USING (true);
CREATE POLICY "video_posts_insert" ON video_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Guest Destinations (evmux-style RTMP fan-out) ─────────────

CREATE TABLE IF NOT EXISTS guest_destinations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       text NOT NULL,       -- e.g. "My YouTube", "Twitch"
  rtmp_url    text NOT NULL,
  stream_key  text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guest_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guest_dest_select" ON guest_destinations FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM streams WHERE streams.id = guest_destinations.stream_id AND streams.user_id = auth.uid())
);
CREATE POLICY "guest_dest_insert" ON guest_destinations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "guest_dest_delete" ON guest_destinations FOR DELETE USING (auth.uid() = user_id);

-- ── Add extra columns to streams table if missing ────────────

ALTER TABLE streams ADD COLUMN IF NOT EXISTS peak_viewers    int  NOT NULL DEFAULT 0;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS total_viewers   int  NOT NULL DEFAULT 0;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS duration_seconds int NOT NULL DEFAULT 0;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS revenue_cents   int  NOT NULL DEFAULT 0;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS chat_messages   int  NOT NULL DEFAULT 0;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS is_audio_only   boolean NOT NULL DEFAULT false;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS is_private      boolean NOT NULL DEFAULT false;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS paywall_price_cents int;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS category        text;

-- ── Supabase Storage bucket for video posts ──────────────────
-- Run this separately in Supabase dashboard → Storage:
-- Create bucket named "video-posts" with public access ON
