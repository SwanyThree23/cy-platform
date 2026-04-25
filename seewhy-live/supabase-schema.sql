-- SeeWhy Live — Supabase Schema
-- Run this in the Supabase SQL Editor

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────────
create type stream_status as enum ('scheduled', 'live', 'ended');
create type account_tier  as enum ('free', 'supporter', 'creator');
create type guest_role    as enum ('guest', 'co-host');
create type stream_category as enum ('MUSIC','GAMING','TALK','SPORTS','EDUCATION','TECH','ART','FITNESS','OTHER');

-- ── Profiles ──────────────────────────────────────────────────────────────────
create table profiles (
  id                  uuid primary key references auth.users on delete cascade,
  username            text unique not null,
  display_name        text not null,
  avatar_url          text,
  bio                 text,
  account_tier        account_tier not null default 'free',
  follower_count      int not null default 0,
  stripe_customer_id  text unique,
  paypal_handle       text,
  cashapp_handle      text,
  venmo_handle        text,
  zelle_handle        text,
  chime_handle        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Own profile writable"     on profiles for update using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'preferred_username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Streams ───────────────────────────────────────────────────────────────────
create table streams (
  id              uuid primary key default uuid_generate_v4(),
  host_id         uuid not null references profiles(id) on delete cascade,
  title           text not null,
  description     text,
  thumbnail_url   text,
  category        stream_category not null default 'TALK',
  status          stream_status not null default 'scheduled',
  viewer_count    int not null default 0,
  peak_viewers    int not null default 0,
  livekit_room    text unique,
  rtmp_key        text unique default encode(gen_random_bytes(16), 'hex'),
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);

alter table streams enable row level security;
create policy "Streams readable by all"   on streams for select using (true);
create policy "Host can create stream"    on streams for insert with check (auth.uid() = host_id);
create policy "Host can update stream"    on streams for update using (auth.uid() = host_id);
create policy "Host can delete stream"    on streams for delete using (auth.uid() = host_id);

create index streams_status_viewers on streams(status, viewer_count desc);

-- ── Stream Guests ─────────────────────────────────────────────────────────────
create table stream_guests (
  id              uuid primary key default uuid_generate_v4(),
  stream_id       uuid not null references streams(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,
  position        int not null check (position between 0 and 19),
  username        text,
  avatar_url      text,
  role            guest_role not null default 'guest',
  is_muted        boolean not null default false,
  is_camera_off   boolean not null default false,
  joined_at       timestamptz not null default now(),
  unique(stream_id, position)
);

alter table stream_guests enable row level security;
create policy "Guests readable by all" on stream_guests for select using (true);

-- ── Chat Messages ─────────────────────────────────────────────────────────────
create table chat_messages (
  id              uuid primary key default uuid_generate_v4(),
  stream_id       uuid not null references streams(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,
  username        text not null,
  avatar_url      text,
  content         text not null check (length(content) between 1 and 500),
  is_donation     boolean not null default false,
  donation_amount int,
  created_at      timestamptz not null default now()
);

create index chat_messages_stream_created on chat_messages(stream_id, created_at desc);

alter table chat_messages enable row level security;
create policy "Chat readable by all"     on chat_messages for select using (true);
create policy "Authenticated can chat"   on chat_messages for insert with check (auth.uid() is not null);

-- ── Follows ───────────────────────────────────────────────────────────────────
create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table follows enable row level security;
create policy "Follows readable by all" on follows for select using (true);
create policy "Auth can follow"         on follows for insert with check (auth.uid() = follower_id);
create policy "Auth can unfollow"       on follows for delete using (auth.uid() = follower_id);

-- Auto-update follower_count
create or replace function update_follower_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update profiles set follower_count = follower_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
  end if;
  return null;
end;
$$;

create trigger follows_count
  after insert or delete on follows
  for each row execute procedure update_follower_count();

-- ── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table streams;
alter publication supabase_realtime add table stream_guests;
alter publication supabase_realtime add table chat_messages;
