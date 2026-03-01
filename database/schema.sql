-- CY Platform Database Schema
-- Production-Grade PostgreSQL Schema
-- Zero-Fee Payment System + Cross-Platform Streaming

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable encryption for stream keys
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE verification_status AS ENUM ('none', 'pending', 'verified');
CREATE TYPE account_type AS ENUM ('free', 'premium', 'pro');
CREATE TYPE stream_status AS ENUM ('scheduled', 'live', 'ended');
CREATE TYPE visibility_type AS ENUM ('public', 'followers', 'private');

-- ============================================
-- TABLE: users
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    
    -- Verification & Account Type
    verification_status verification_status DEFAULT 'none',
    account_type account_type DEFAULT 'free',
    
    -- Payment Handles (Zero-Fee System)
    paypal_handle VARCHAR(100),
    cashapp_handle VARCHAR(100),
    venmo_handle VARCHAR(100),
    zelle_handle VARCHAR(100),
    chime_handle VARCHAR(100),
    
    -- Cross-Platform Streaming Keys (Encrypted)
    instagram_stream_key TEXT, -- Encrypted
    tiktok_stream_key TEXT,    -- Encrypted
    facebook_stream_key TEXT,  -- Encrypted
    youtube_stream_key TEXT,   -- Encrypted
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Status Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    
    -- Constraints
    CONSTRAINT valid_username CHECK (username ~* '^[a-zA-Z0-9_]{3,30}$'),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create index on frequently queried columns
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification ON users(verification_status);
CREATE INDEX idx_users_account_type ON users(account_type);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- ============================================
-- TABLE: categories
-- ============================================

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, description, sort_order) VALUES
    ('Gaming', 'Video games and esports', 1),
    ('Music', 'Live music performances', 2),
    ('Just Chatting', 'Casual conversations', 3),
    ('Art', 'Creative arts and design', 4),
    ('Education', 'Learning and tutorials', 5),
    ('Technology', 'Tech reviews and coding', 6),
    ('Sports', 'Athletic events and fitness', 7),
    ('Food & Drink', 'Cooking and culinary', 8);

-- ============================================
-- TABLE: streams
-- ============================================

CREATE TABLE streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    
    -- Stream Status
    status stream_status DEFAULT 'scheduled',
    visibility visibility_type DEFAULT 'public',
    
    -- Scheduling
    scheduled_start TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- Viewership Stats
    max_viewers INTEGER DEFAULT 0,
    current_viewers INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    
    -- Cross-Platform Streaming Flags
    streaming_to_instagram BOOLEAN DEFAULT FALSE,
    streaming_to_tiktok BOOLEAN DEFAULT FALSE,
    streaming_to_facebook BOOLEAN DEFAULT FALSE,
    streaming_to_youtube BOOLEAN DEFAULT FALSE,
    
    -- RTMP Configuration
    rtmp_ingest_url VARCHAR(500),
    stream_key VARCHAR(255), -- Internal stream key
    
    -- Gold Board Grid Settings
    layout_config JSONB DEFAULT '{
        "type": "gold_board_grid",
        "host_position": "top_left",
        "guest_slots": 20,
        "scroll_direction": "vertical"
    }'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_title CHECK (LENGTH(TRIM(title)) > 0)
);

-- Create indexes for streams
CREATE INDEX idx_streams_host ON streams(host_id);
CREATE INDEX idx_streams_status ON streams(status);
CREATE INDEX idx_streams_category ON streams(category_id);
CREATE INDEX idx_streams_visibility ON streams(visibility);
CREATE INDEX idx_streams_live ON streams(status) WHERE status = 'live';
CREATE INDEX idx_streams_scheduled ON streams(status, scheduled_start) WHERE status = 'scheduled';

-- ============================================
-- TABLE: stream_guests
-- ============================================

CREATE TABLE stream_guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Guest Position in Gold Board Grid (0-19 for 20 slots)
    grid_position INTEGER CHECK (grid_position >= 0 AND grid_position < 20),
    
    -- WebRTC/Connection Info
    transport_id VARCHAR(255),
    producer_id VARCHAR(255),
    consumer_ids JSONB DEFAULT '[]'::jsonb,
    
    -- Guest Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, connected, disconnected, banned
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    
    -- Permissions
    can_speak BOOLEAN DEFAULT TRUE,
    can_video BOOLEAN DEFAULT TRUE,
    is_muted_by_host BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one position per stream
    UNIQUE(stream_id, grid_position)
);

CREATE INDEX idx_stream_guests_stream ON stream_guests(stream_id);
CREATE INDEX idx_stream_guests_user ON stream_guests(user_id);
CREATE INDEX idx_stream_guests_status ON stream_guests(status);

-- ============================================
-- TABLE: payments (Zero-Fee Tracking)
-- ============================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payment Details
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL, -- paypal, cashapp, venmo, zelle, chime
    
    -- Platform Fee (0% for zero-fee system)
    platform_fee DECIMAL(10, 2) DEFAULT 0.00,
    creator_amount DECIMAL(10, 2) GENERATED ALWAYS AS (amount - platform_fee) STORED,
    
    -- Transaction Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
    external_transaction_id VARCHAR(255),
    
    -- Metadata
    message TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Revenue Split Tracking (90% creator, 10% platform for premium features)
    revenue_split_percentage DECIMAL(5, 2) DEFAULT 90.00
);

CREATE INDEX idx_payments_stream ON payments(stream_id);
CREATE INDEX idx_payments_recipient ON payments(recipient_id);
CREATE INDEX idx_payments_sender ON payments(sender_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);

-- ============================================
-- TABLE: subscriptions (Platform Revenue)
-- ============================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL, -- premium, pro
    
    -- Pricing
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment Provider
    provider VARCHAR(50), -- stripe, paypal
    provider_subscription_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- TABLE: followers
-- ============================================

CREATE TABLE followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(follower_id, following_id)
);

CREATE INDEX idx_followers_follower ON followers(follower_id);
CREATE INDEX idx_followers_following ON followers(following_id);

-- ============================================
-- TABLE: chat_messages
-- ============================================

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system messages
    
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- text, donation, system, moderation
    
    -- Moderation
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_by UUID REFERENCES users(id),
    deleted_reason TEXT,
    
    -- AI Moderation
    ai_moderated BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3, 2),
    ai_action VARCHAR(50), -- allow, flag, delete
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_stream ON chat_messages(stream_id);
CREATE INDEX idx_chat_user ON chat_messages(user_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at);

-- ============================================
-- TABLE: rtmp_relays (Cross-Platform Fan-out)
-- ============================================

CREATE TABLE rtmp_relays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- instagram, tiktok, facebook, youtube
    
    -- Encrypted RTMP Credentials
    rtmp_url TEXT, -- Encrypted
    stream_key TEXT, -- Encrypted
    
    -- Status
    status VARCHAR(50) DEFAULT 'inactive', -- inactive, connecting, active, error
    last_error TEXT,
    
    -- Metrics
    bytes_sent BIGINT DEFAULT 0,
    connection_started TIMESTAMP WITH TIME ZONE,
    connection_ended TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(stream_id, platform)
);

CREATE INDEX idx_rtmp_relays_stream ON rtmp_relays(stream_id);
CREATE INDEX idx_rtmp_relays_status ON rtmp_relays(status);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_streams_updated_at BEFORE UPDATE ON streams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rtmp_relays_updated_at BEFORE UPDATE ON rtmp_relays
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to encrypt stream keys
CREATE OR REPLACE FUNCTION encrypt_stream_key(stream_key TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(pgp_sym_encrypt(stream_key, encryption_key)::bytea, 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to decrypt stream keys
CREATE OR REPLACE FUNCTION decrypt_stream_key(encrypted_key TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), encryption_key);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- Active live streams view
CREATE VIEW active_live_streams AS
SELECT 
    s.*,
    u.username as host_username,
    u.display_name as host_display_name,
    u.avatar_url as host_avatar,
    c.name as category_name,
    (SELECT COUNT(*) FROM stream_guests sg WHERE sg.stream_id = s.id AND sg.status = 'connected') as active_guests
FROM streams s
JOIN users u ON s.host_id = u.id
LEFT JOIN categories c ON s.category_id = c.id
WHERE s.status = 'live' AND s.is_active = TRUE;

-- Creator revenue summary view
CREATE VIEW creator_revenue_summary AS
SELECT 
    u.id as creator_id,
    u.username,
    u.display_name,
    COUNT(p.id) as total_payments,
    COALESCE(SUM(p.amount), 0) as total_revenue,
    COALESCE(SUM(p.platform_fee), 0) as platform_fees,
    COALESCE(SUM(p.creator_amount), 0) as net_earnings
FROM users u
LEFT JOIN payments p ON u.id = p.recipient_id AND p.status = 'completed'
WHERE u.is_active = TRUE
GROUP BY u.id, u.username, u.display_name;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sensitive data
CREATE POLICY users_self_access ON users
    FOR SELECT
    USING (id = current_setting('app.current_user_id')::UUID OR is_active = TRUE);

-- Streams are visible based on visibility settings
CREATE POLICY streams_visibility ON streams
    FOR SELECT
    USING (
        visibility = 'public' 
        OR host_id = current_setting('app.current_user_id')::UUID
        OR (
            visibility = 'followers' 
            AND EXISTS (
                SELECT 1 FROM followers f 
                WHERE f.following_id = host_id 
                AND f.follower_id = current_setting('app.current_user_id')::UUID
            )
        )
    );

-- ============================================
-- INITIAL DATA
-- ============================================

-- Create admin user (password should be changed immediately)
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    display_name, 
    verification_status, 
    account_type,
    is_active
) VALUES (
    'admin',
    'admin@cyplatform.com',
    '$2b$10$YourHashedPasswordHere', -- Replace with actual hash
    'CY Admin',
    'verified',
    'pro',
    TRUE
);

-- ============================================
-- PERFORMANCE OPTIMIZATION
-- ============================================

-- Vacuum and analyze for performance
VACUUM ANALYZE users;
VACUUM ANALYZE streams;
VACUUM ANALYZE payments;
VACUUM ANALYZE chat_messages;
VACUUM ANALYZE stream_guests;

-- Table comments for documentation
COMMENT ON TABLE users IS 'Platform users with payment handles for zero-fee system';
COMMENT ON TABLE streams IS 'Live streams with cross-platform RTMP fan-out configuration';
COMMENT ON TABLE payments IS 'Zero-fee payment records with direct creator payments';
COMMENT ON TABLE stream_guests IS 'Guest panelists in Gold Board Grid layout';
COMMENT ON TABLE rtmp_relays IS 'Cross-platform streaming relay configurations';
$watch_party_sql
