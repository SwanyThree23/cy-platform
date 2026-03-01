"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const supabase_js_1 = require("@supabase/supabase-js");
const mediasoup = __importStar(require("mediasoup"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
// Encryption Key for Stream Credentials
const ENCRYPTION_KEY = process.env.STREAM_ENCRYPTION_KEY || crypto_1.default.randomBytes(32).toString("hex");
// Mediasoup Configuration
const MEDIASOUP_CONFIG = {
    worker: {
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
        logLevel: "warn",
        logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
    },
    router: {
        mediaCodecs: [
            {
                kind: "audio",
                mimeType: "audio/opus",
                clockRate: 48000,
                channels: 2,
            },
            {
                kind: "video",
                mimeType: "video/VP8",
                clockRate: 90000,
                parameters: {
                    "x-google-start-bitrate": 1000,
                },
            },
            {
                kind: "video",
                mimeType: "video/H264",
                clockRate: 90000,
                parameters: {
                    "packetization-mode": 1,
                    "profile-level-id": "4d0032",
                    "level-asymmetry-allowed": 1,
                },
            },
        ],
    },
    webRtcTransport: {
        listenIps: [
            {
                ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
                announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
            },
        ],
        initialAvailableOutgoingBitrate: 1000000,
        minimumAvailableOutgoingBitrate: 600000,
        maxSctpMessageSize: 262144,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    },
};
// RTMP Fan-out Configuration
const RTMP_CONFIG = {
    instagram: {
        url: "rtmps://live-upload.instagram.com:443/rtmp/",
        enabled: true,
    },
    tiktok: {
        url: "rtmp://push-rtmp-f5-tt02.tiktokcdn.com/stage/",
        enabled: true,
    },
    facebook: { url: "rtmps://live-api-s.facebook.com:443/rtmp/", enabled: true },
    youtube: { url: "rtmp://a.rtmp.youtube.com/live2/", enabled: true },
};
// ============================================
// INITIALIZE SERVICES
// ============================================
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
    },
    transports: ["websocket", "polling"],
});
// Supabase Client
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY);
// ============================================
// MIDDLEWARE
// ============================================
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api/", limiter);
// ============================================
// MEDIASOUP SFU MANAGER
// ============================================
class MediasoupManager extends events_1.EventEmitter {
    workers = [];
    routers = new Map();
    transports = new Map();
    producers = new Map();
    consumers = new Map();
    nextWorkerIndex = 0;
    async initialize(numWorkers = 2) {
        console.log(`[Mediasoup] Initializing ${numWorkers} workers...`);
        for (let i = 0; i < numWorkers; i++) {
            const worker = await mediasoup.createWorker(MEDIASOUP_CONFIG.worker);
            worker.on("died", () => {
                console.error(`[Mediasoup] Worker ${i} died, restarting...`);
                this.restartWorker(i);
            });
            this.workers.push(worker);
        }
        console.log("[Mediasoup] All workers initialized successfully");
    }
    async restartWorker(index) {
        const worker = await mediasoup.createWorker(MEDIASOUP_CONFIG.worker);
        this.workers[index] = worker;
        console.log(`[Mediasoup] Worker ${index} restarted`);
    }
    getNextWorker() {
        const worker = this.workers[this.nextWorkerIndex];
        this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
        return worker;
    }
    async createRouter(roomId) {
        if (this.routers.has(roomId)) {
            return this.routers.get(roomId);
        }
        const worker = this.getNextWorker();
        const router = await worker.createRouter({
            mediaCodecs: MEDIASOUP_CONFIG.router.mediaCodecs,
        });
        this.routers.set(roomId, router);
        console.log(`[Mediasoup] Router created for room: ${roomId}`);
        return router;
    }
    async createWebRtcTransport(roomId, peerId) {
        const router = await this.createRouter(roomId);
        const transport = await router.createWebRtcTransport(MEDIASOUP_CONFIG.webRtcTransport);
        const transportId = `${roomId}:${peerId}`;
        this.transports.set(transportId, transport);
        transport.on("dtlsstatechange", (dtlsState) => {
            if (dtlsState === "closed") {
                transport.close();
                this.transports.delete(transportId);
            }
        });
        console.log(`[Mediasoup] WebRTC Transport created for peer: ${peerId} in room: ${roomId}`);
        return transport;
    }
    async createProducer(transportId, kind, rtpParameters) {
        const transport = this.transports.get(transportId);
        if (!transport) {
            throw new Error(`Transport not found: ${transportId}`);
        }
        const producer = await transport.produce({ kind, rtpParameters });
        this.producers.set(producer.id, producer);
        producer.on("transportclose", () => {
            producer.close();
            this.producers.delete(producer.id);
        });
        console.log(`[Mediasoup] Producer created: ${producer.id} (${kind})`);
        return producer;
    }
    async createConsumer(transportId, producerId, rtpCapabilities) {
        const transport = this.transports.get(transportId);
        if (!transport) {
            throw new Error(`Transport not found: ${transportId}`);
        }
        const producer = this.producers.get(producerId);
        if (!producer) {
            return null;
        }
        if (!transport.router?.rtpCapabilities ||
            !transport.router?.canConsume({ producerId, rtpCapabilities })) {
            console.error(`[Mediasoup] Cannot consume ${producerId}`);
            return null;
        }
        const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: false,
        });
        this.consumers.set(consumer.id, consumer);
        consumer.on("transportclose", () => {
            consumer.close();
            this.consumers.delete(consumer.id);
        });
        consumer.on("producerclose", () => {
            consumer.close();
            this.consumers.delete(consumer.id);
        });
        console.log(`[Mediasoup] Consumer created: ${consumer.id} for producer: ${producerId}`);
        return consumer;
    }
    getRouter(roomId) {
        return this.routers.get(roomId);
    }
    getProducer(producerId) {
        return this.producers.get(producerId);
    }
    closeRoom(roomId) {
        const router = this.routers.get(roomId);
        if (router) {
            router.close();
            this.routers.delete(roomId);
        }
        // Clean up associated transports
        for (const [id, transport] of this.transports.entries()) {
            if (id.startsWith(`${roomId}:`)) {
                transport.close();
                this.transports.delete(id);
            }
        }
        console.log(`[Mediasoup] Room closed: ${roomId}`);
    }
    getStats() {
        return {
            workers: this.workers.length,
            routers: this.routers.size,
            transports: this.transports.size,
            producers: this.producers.size,
            consumers: this.consumers.size,
        };
    }
}
const mediasoupManager = new MediasoupManager();
// ============================================
// RTMP FAN-OUT MANAGER
// ============================================
class RTMPFanOutManager extends events_1.EventEmitter {
    ffmpegProcesses = new Map();
    activeStreams = new Map();
    async startFanOut(streamId, platforms, streamKey) {
        console.log(`[RTMP] Starting fan-out for stream: ${streamId} to platforms: ${platforms.join(", ")}`);
        if (!this.activeStreams.has(streamId)) {
            this.activeStreams.set(streamId, new Set());
        }
        const activePlatforms = this.activeStreams.get(streamId);
        for (const platform of platforms) {
            if (activePlatforms.has(platform)) {
                console.log(`[RTMP] Already streaming to ${platform} for stream: ${streamId}`);
                continue;
            }
            const config = RTMP_CONFIG[platform];
            if (!config || !config.enabled) {
                console.warn(`[RTMP] Platform ${platform} not configured or disabled`);
                continue;
            }
            await this.startPlatformStream(streamId, platform, config.url, streamKey);
            activePlatforms.add(platform);
        }
        // Update database
        await this.updateStreamPlatforms(streamId, platforms, true);
    }
    async startPlatformStream(streamId, platform, rtmpUrl, streamKey) {
        const processId = `${streamId}:${platform}`;
        // Get user's encrypted stream key for this platform
        const { data: streamData, error } = await supabase
            .from("streams")
            .select(`host:users!inner(${platform}_stream_key)`)
            .eq("id", streamId)
            .single();
        if (error || !streamData) {
            console.error(`[RTMP] Failed to get stream key for ${platform}:`, error);
            return;
        }
        // Decrypt the platform-specific stream key
        const encryptedKey = streamData.host[`${platform}_stream_key`];
        if (!encryptedKey) {
            console.warn(`[RTMP] No stream key configured for ${platform}`);
            return;
        }
        const platformStreamKey = this.decryptStreamKey(encryptedKey);
        const fullRtmpUrl = `${rtmpUrl}${platformStreamKey}`;
        console.log(`[RTMP] Starting FFmpeg to ${platform}: ${rtmpUrl}***`);
        const ffmpegProcess = (0, fluent_ffmpeg_1.default)()
            .input(`rtmp://localhost:1935/live/${streamKey}`)
            .inputOptions(["-re", "-fflags +genpts"])
            .videoCodec("libx264")
            .audioCodec("aac")
            .outputOptions([
            "-preset veryfast",
            "-tune zerolatency",
            "-b:v 2500k",
            "-maxrate 2500k",
            "-bufsize 5000k",
            "-pix_fmt yuv420p",
            "-g 60",
            "-c:a aac",
            "-b:a 128k",
            "-ar 44100",
            "-f flv",
        ])
            .output(fullRtmpUrl)
            .on("start", (commandLine) => {
            console.log(`[RTMP] FFmpeg started for ${platform}: ${commandLine}`);
        })
            .on("error", (err) => {
            console.error(`[RTMP] FFmpeg error for ${platform}:`, err.message);
            this.handleStreamError(streamId, platform, err.message);
        })
            .on("end", () => {
            console.log(`[RTMP] FFmpeg ended for ${platform}`);
            this.stopPlatformStream(streamId, platform);
        });
        ffmpegProcess.run();
        this.ffmpegProcesses.set(processId, ffmpegProcess);
        // Update relay status
        await supabase.from("rtmp_relays").upsert({
            stream_id: streamId,
            platform: platform,
            status: "active",
            connection_started: new Date().toISOString(),
        }, { onConflict: "stream_id,platform" });
    }
    decryptStreamKey(encryptedKey) {
        try {
            const decipher = crypto_1.default.createDecipher("aes-256-cbc", ENCRYPTION_KEY);
            let decrypted = decipher.update(encryptedKey, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        }
        catch (error) {
            console.error("[RTMP] Failed to decrypt stream key:", error);
            return "";
        }
    }
    async handleStreamError(streamId, platform, error) {
        console.error(`[RTMP] Stream error for ${platform}:`, error);
        await supabase.from("rtmp_relays").upsert({
            stream_id: streamId,
            platform: platform,
            status: "error",
            last_error: error,
            connection_ended: new Date().toISOString(),
        }, { onConflict: "stream_id,platform" });
        this.emit("streamError", { streamId, platform, error });
    }
    async stopPlatformStream(streamId, platform) {
        const processId = `${streamId}:${platform}`;
        const ffmpegProcess = this.ffmpegProcesses.get(processId);
        if (ffmpegProcess) {
            ffmpegProcess.kill("SIGTERM");
            this.ffmpegProcesses.delete(processId);
        }
        const activePlatforms = this.activeStreams.get(streamId);
        if (activePlatforms) {
            activePlatforms.delete(platform);
        }
        // Update database
        await supabase.from("rtmp_relays").upsert({
            stream_id: streamId,
            platform: platform,
            status: "inactive",
            connection_ended: new Date().toISOString(),
        }, { onConflict: "stream_id,platform" });
        await this.updateStreamPlatforms(streamId, [platform], false);
        console.log(`[RTMP] Stopped streaming to ${platform} for stream: ${streamId}`);
    }
    async stopAllStreams(streamId) {
        const activePlatforms = this.activeStreams.get(streamId);
        if (activePlatforms) {
            for (const platform of activePlatforms) {
                await this.stopPlatformStream(streamId, platform);
            }
            this.activeStreams.delete(streamId);
        }
        console.log(`[RTMP] All streams stopped for: ${streamId}`);
    }
    async updateStreamPlatforms(streamId, platforms, isActive) {
        const updates = {};
        platforms.forEach((platform) => {
            updates[`streaming_to_${platform}`] = isActive;
        });
        await supabase.from("streams").update(updates).eq("id", streamId);
    }
    getActiveStreams() {
        return this.activeStreams;
    }
}
const rtmpManager = new RTMPFanOutManager();
// ============================================
// SWANI AI WRAPPER (Enhanced)
// ============================================
class SwaniAIWrapper {
    apiKey;
    defaultModel;
    apiUrl;
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || "";
        this.defaultModel = process.env.LLM_MODEL || "anthropic/claude-3.5-sonnet";
        this.apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    }
    async moderateMessage(message, context = {}) {
        try {
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:3000",
                },
                body: JSON.stringify({
                    model: this.defaultModel,
                    messages: [
                        {
                            role: "system",
                            content: `You are a content moderation AI for a live streaming platform. 
Analyze the following message and determine if it should be allowed, flagged for review, or deleted immediately.
Consider: hate speech, harassment, spam, explicit content, violence, self-harm, misinformation.

Respond with a JSON object in this exact format:
{
  "action": "allow" | "flag" | "delete",
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation if flagged or deleted"
}

Be strict but fair. Allow casual conversation and mild profanity. Delete only severe violations.`,
                        },
                        {
                            role: "user",
                            content: `Message to moderate: "${message}"\nContext: ${JSON.stringify(context)}`,
                        },
                    ],
                    max_tokens: 150,
                    temperature: 0.1,
                }),
            });
            if (!response.ok)
                throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            const content = data.choices[0]?.message?.content || "";
            const result = JSON.parse(content);
            return {
                action: result.action || "allow",
                confidence: result.confidence || 0.5,
                reason: result.reason,
            };
        }
        catch (error) {
            console.error("[SwaniAI] Moderation error:", error);
            return {
                action: "allow",
                confidence: 0.0,
                reason: "AI moderation failed",
            };
        }
    }
    async askAI(prompt, context = {}, model) {
        try {
            const selectedModel = model || this.defaultModel;
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:3000",
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        {
                            role: "system",
                            content: "You are an AI assistant integrated into a live streaming and watch party platform. Provide helpful, concise, and engaging responses.",
                        },
                        {
                            role: "user",
                            content: `Context: ${JSON.stringify(context)}\n\nPrompt: ${prompt}`,
                        },
                    ],
                    max_tokens: 500,
                    temperature: 0.7,
                }),
            });
            if (!response.ok)
                throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        }
        catch (error) {
            console.error("[SwaniAI] AI Ask error:", error);
            return "I am sorry, I am having trouble connecting to my brain right now.";
        }
    }
    async compressMessage(message, maxLength = 200) {
        if (message.length <= maxLength)
            return message;
        try {
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.defaultModel,
                    messages: [
                        {
                            role: "system",
                            content: `Compress the following message to be under ${maxLength} characters while preserving the key meaning.`,
                        },
                        { role: "user", content: message },
                    ],
                    max_tokens: 100,
                    temperature: 0.3,
                }),
            });
            if (!response.ok)
                return message.substring(0, maxLength) + "...";
            const data = await response.json();
            return (data.choices[0]?.message?.content ||
                message.substring(0, maxLength) + "...");
        }
        catch (error) {
            return message.substring(0, maxLength) + "...";
        }
    }
}
const swaniAI = new SwaniAIWrapper();
// ============================================
// WATCH PARTY MANAGER
// ============================================
class WatchPartyManager extends events_1.EventEmitter {
    activeParties = new Map();
    async createParty(hostId, partyData) {
        const inviteCode = crypto_1.default.randomBytes(4).toString("hex").toUpperCase();
        const { data, error } = await supabase
            .from("watch_parties")
            .insert({
            host_id: hostId,
            title: partyData.title,
            description: partyData.description,
            video_url: partyData.videoUrl,
            video_source: partyData.videoSource || "youtube",
            video_id: partyData.videoId,
            invite_code: inviteCode,
            visibility: partyData.visibility || "public",
            status: "active",
        })
            .select()
            .single();
        if (error)
            throw new Error(`Failed to create watch party: ${error.message}`);
        this.activeParties.set(data.id, {
            hostId,
            inviteCode,
            participants: new Map(), // userId -> { socketId, isReady, status }
            playback: {
                currentTime: 0,
                isPlaying: false,
                lastUpdated: Date.now(),
            },
        });
        return data;
    }
    async joinParty(partyId, userId, socketId) {
        const party = this.activeParties.get(partyId);
        if (!party) {
            // Try to load from DB if not in memory
            const { data, error } = await supabase
                .from("watch_parties")
                .select("*")
                .eq("id", partyId)
                .single();
            if (error || !data)
                throw new Error("Watch party not found");
            // Initialize in memory
            this.activeParties.set(data.id, {
                hostId: data.host_id,
                inviteCode: data.invite_code,
                participants: new Map(),
                playback: {
                    currentTime: data.current_time_seconds || 0,
                    isPlaying: data.is_playing,
                    lastUpdated: Date.now(),
                },
            });
        }
        const { error } = await supabase.from("watch_party_participants").upsert({
            watch_party_id: partyId,
            user_id: userId,
            status: "connected",
        });
        if (error)
            throw error;
        const currentParty = this.activeParties.get(partyId);
        currentParty.participants.set(userId, {
            socketId,
            isReady: false,
            status: "connected",
        });
        return currentParty;
    }
    updatePlayback(partyId, currentTime, isPlaying) {
        const party = this.activeParties.get(partyId);
        if (party) {
            party.playback = {
                currentTime,
                isPlaying,
                lastUpdated: Date.now(),
            };
            // debounced update to DB could go here
        }
    }
    async setReadyStatus(partyId, userId, isReady) {
        const party = this.activeParties.get(partyId);
        if (party) {
            const participant = party.participants.get(userId);
            if (participant) {
                participant.isReady = isReady;
                await supabase
                    .from("watch_party_participants")
                    .update({
                    is_ready: isReady,
                    status: isReady ? "ready" : "connected",
                })
                    .eq("watch_party_id", partyId)
                    .eq("user_id", userId);
                return true;
            }
        }
        return false;
    }
    getPartyByInviteCode(inviteCode) {
        return Array.from(this.activeParties.values()).find((p) => p.inviteCode === inviteCode);
    }
    removeParticipant(partyId, userId) {
        const party = this.activeParties.get(partyId);
        if (party) {
            party.participants.delete(userId);
        }
    }
}
const watchPartyManager = new WatchPartyManager();
// ============================================
// STREAM MANAGER
// ============================================
class StreamManager extends events_1.EventEmitter {
    activeStreams = new Map();
    async createStream(hostId, streamData) {
        const streamKey = crypto_1.default.randomBytes(16).toString("hex");
        const { data, error } = await supabase
            .from("streams")
            .insert({
            host_id: hostId,
            title: streamData.title,
            description: streamData.description,
            category_id: streamData.categoryId,
            visibility: streamData.visibility || "public",
            scheduled_start: streamData.scheduledStart,
            status: "scheduled",
            stream_key: streamKey,
            layout_config: {
                type: "gold_board_grid",
                host_position: "top_left",
                guest_slots: 20,
                scroll_direction: "vertical",
            },
        })
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create stream: ${error.message}`);
        }
        return data;
    }
    async goLive(streamId, platforms = []) {
        const { data: stream, error } = await supabase
            .from("streams")
            .update({
            status: "live",
            actual_start: new Date().toISOString(),
        })
            .eq("id", streamId)
            .select()
            .single();
        if (error || !stream) {
            throw new Error("Failed to start stream");
        }
        // Initialize Mediasoup router for this stream
        await mediasoupManager.createRouter(streamId);
        // Start RTMP fan-out to platforms
        if (platforms.length > 0) {
            await rtmpManager.startFanOut(streamId, platforms, stream.stream_key);
        }
        this.activeStreams.set(streamId, {
            hostId: stream.host_id,
            startTime: new Date(),
            viewers: new Set(),
            guests: new Map(), // peerId -> grid position
        });
        this.emit("streamStarted", { streamId, hostId: stream.host_id });
        return stream;
    }
    async endStream(streamId) {
        const { error } = await supabase
            .from("streams")
            .update({
            status: "ended",
            ended_at: new Date().toISOString(),
        })
            .eq("id", streamId);
        if (error) {
            console.error("Failed to end stream:", error);
        }
        // Stop RTMP fan-out
        await rtmpManager.stopAllStreams(streamId);
        // Close Mediasoup room
        mediasoupManager.closeRoom(streamId);
        const streamData = this.activeStreams.get(streamId);
        if (streamData) {
            this.emit("streamEnded", {
                streamId,
                hostId: streamData.hostId,
                duration: Date.now() - streamData.startTime.getTime(),
                maxViewers: streamData.maxViewers || 0,
            });
            this.activeStreams.delete(streamId);
        }
        return { success: true };
    }
    getActiveStream(streamId) {
        return this.activeStreams.get(streamId);
    }
    getAllActiveStreams() {
        return Array.from(this.activeStreams.entries()).map(([streamId, data]) => ({
            streamId,
            hostId: data.hostId,
            viewerCount: data.viewers.size,
        }));
    }
    async addViewer(streamId, viewerId) {
        const stream = this.activeStreams.get(streamId);
        if (stream) {
            stream.viewers.add(viewerId);
            // Update current viewers count
            await supabase
                .from("streams")
                .update({
                current_viewers: stream.viewers.size,
                total_views: supabase.rpc("increment", { row_id: streamId }),
            })
                .eq("id", streamId);
            if (!stream.maxViewers || stream.viewers.size > stream.maxViewers) {
                stream.maxViewers = stream.viewers.size;
                await supabase
                    .from("streams")
                    .update({ max_viewers: stream.maxViewers })
                    .eq("id", streamId);
            }
        }
    }
    async removeViewer(streamId, viewerId) {
        const stream = this.activeStreams.get(streamId);
        if (stream) {
            stream.viewers.delete(viewerId);
            await supabase
                .from("streams")
                .update({ current_viewers: stream.viewers.size })
                .eq("id", streamId);
        }
    }
    async addGuest(streamId, userId, gridPosition) {
        const stream = this.activeStreams.get(streamId);
        if (!stream) {
            throw new Error("Stream not found");
        }
        // Check if position is available
        for (const [_, pos] of stream.guests.entries()) {
            if (pos === gridPosition) {
                throw new Error("Grid position already occupied");
            }
        }
        const guestId = crypto_1.default.randomUUID();
        stream.guests.set(guestId, {
            userId,
            gridPosition,
            joinedAt: new Date(),
        });
        // Update database
        await supabase.from("stream_guests").insert({
            stream_id: streamId,
            user_id: userId,
            grid_position: gridPosition,
            status: "connected",
            joined_at: new Date().toISOString(),
        });
        this.emit("guestJoined", { streamId, guestId, userId, gridPosition });
        return guestId;
    }
    async removeGuest(streamId, guestId) {
        const stream = this.activeStreams.get(streamId);
        if (stream && stream.guests.has(guestId)) {
            const guest = stream.guests.get(guestId);
            stream.guests.delete(guestId);
            await supabase
                .from("stream_guests")
                .update({
                status: "disconnected",
                left_at: new Date().toISOString(),
            })
                .eq("stream_id", streamId)
                .eq("user_id", guest.userId);
            this.emit("guestLeft", { streamId, guestId, userId: guest.userId });
        }
    }
}
const streamManager = new StreamManager();
// ============================================
// API ROUTES
// ============================================
// Health Check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        mediasoup: mediasoupManager.getStats(),
        activeStreams: streamManager.getAllActiveStreams().length,
    });
});
// Get Mediasoup Router RTP Capabilities
app.get("/api/streams/:streamId/rtp-capabilities", async (req, res) => {
    try {
        const { streamId } = req.params;
        const router = await mediasoupManager.createRouter(streamId);
        res.json({
            rtpCapabilities: router.rtpCapabilities,
        });
    }
    catch (error) {
        console.error("Error getting RTP capabilities:", error);
        res.status(500).json({ error: "Failed to get RTP capabilities" });
    }
});
// Create WebRTC Transport
app.post("/api/streams/:streamId/transport", async (req, res) => {
    try {
        const { streamId } = req.params;
        const { peerId, direction } = req.body;
        const transport = await mediasoupManager.createWebRtcTransport(streamId, peerId);
        res.json({
            transportId: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });
    }
    catch (error) {
        console.error("Error creating transport:", error);
        res.status(500).json({ error: "Failed to create transport" });
    }
});
// Connect Transport
app.post("/api/streams/:streamId/transport/:transportId/connect", async (req, res) => {
    try {
        const { streamId, transportId } = req.params;
        const { dtlsParameters } = req.body;
        const transport = mediasoupManager.transports?.get(`${streamId}:${transportId}`);
        if (!transport) {
            return res.status(404).json({ error: "Transport not found" });
        }
        await transport.connect({ dtlsParameters });
        res.json({ connected: true });
    }
    catch (error) {
        console.error("Error connecting transport:", error);
        res.status(500).json({ error: "Failed to connect transport" });
    }
});
// Produce (Publish media)
app.post("/api/streams/:streamId/transport/:transportId/produce", async (req, res) => {
    try {
        const { streamId, transportId } = req.params;
        const { kind, rtpParameters } = req.body;
        const producer = await mediasoupManager.createProducer(`${streamId}:${transportId}`, kind, rtpParameters);
        res.json({
            producerId: producer.id,
        });
    }
    catch (error) {
        console.error("Error producing:", error);
        res.status(500).json({ error: "Failed to produce" });
    }
});
// Consume (Subscribe to media)
app.post("/api/streams/:streamId/transport/:transportId/consume", async (req, res) => {
    try {
        const { streamId, transportId } = req.params;
        const { producerId, rtpCapabilities } = req.body;
        const consumer = await mediasoupManager.createConsumer(`${streamId}:${transportId}`, producerId, rtpCapabilities);
        if (!consumer) {
            return res.status(400).json({ error: "Cannot consume" });
        }
        res.json({
            consumerId: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        });
    }
    catch (error) {
        console.error("Error consuming:", error);
        res.status(500).json({ error: "Failed to consume" });
    }
});
// Get active producers in a room
app.get("/api/streams/:streamId/producers", (req, res) => {
    const { streamId } = req.params;
    const router = mediasoupManager.getRouter(streamId);
    if (!router) {
        return res.json({ producers: [] });
    }
    // This is simplified - in production you'd track producers properly
    res.json({ producers: [] });
});
// Get active streams
app.get("/api/streams", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("active_live_streams")
            .select("*")
            .order("actual_start", { ascending: false });
        if (error) {
            throw error;
        }
        res.json(data);
    }
    catch (error) {
        console.error("Error fetching streams:", error);
        res.status(500).json({ error: "Failed to fetch streams" });
    }
});
// Get stream by ID
app.get("/api/streams/:streamId", async (req, res) => {
    try {
        const { streamId } = req.params;
        const { data, error } = await supabase
            .from("streams")
            .select("*, host:users!host_id(username, display_name, avatar_url, verification_status)")
            .eq("id", streamId)
            .single();
        if (error) {
            return res.status(404).json({ error: "Stream not found" });
        }
        res.json(data);
    }
    catch (error) {
        console.error("Error fetching stream:", error);
        res.status(500).json({ error: "Failed to fetch stream" });
    }
});
// Create stream
app.post("/api/streams", async (req, res) => {
    try {
        const { hostId, ...streamData } = req.body;
        const stream = await streamManager.createStream(hostId, streamData);
        res.status(201).json(stream);
    }
    catch (error) {
        console.error("Error creating stream:", error);
        res.status(500).json({ error: "Failed to create stream" });
    }
});
// Start streaming (go live)
app.post("/api/streams/:streamId/go-live", async (req, res) => {
    try {
        const { streamId } = req.params;
        const { platforms } = req.body;
        const stream = await streamManager.goLive(streamId, platforms);
        res.json(stream);
    }
    catch (error) {
        console.error("Error going live:", error);
        res.status(500).json({ error: "Failed to start stream" });
    }
});
// End stream
app.post("/api/streams/:streamId/end", async (req, res) => {
    try {
        const { streamId } = req.params;
        await streamManager.endStream(streamId);
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error ending stream:", error);
        res.status(500).json({ error: "Failed to end stream" });
    }
});
// Get user payment handles (for donation buttons)
app.get("/api/users/:userId/payment-handles", async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from("users")
            .select("paypal_handle, cashapp_handle, venmo_handle, zelle_handle, chime_handle, display_name")
            .eq("id", userId)
            .single();
        if (error) {
            return res.status(404).json({ error: "User not found" });
        }
        // Only return handles that are configured
        const handles = {};
        if (data.paypal_handle)
            handles.paypal = data.paypal_handle;
        if (data.cashapp_handle)
            handles.cashapp = data.cashapp_handle;
        if (data.venmo_handle)
            handles.venmo = data.venmo_handle;
        if (data.zelle_handle)
            handles.zelle = data.zelle_handle;
        if (data.chime_handle)
            handles.chime = data.chime_handle;
        res.json({
            displayName: data.display_name,
            handles,
        });
    }
    catch (error) {
        console.error("Error fetching payment handles:", error);
        res.status(500).json({ error: "Failed to fetch payment handles" });
    }
});
// Update user payment handles
app.put("/api/users/:userId/payment-handles", async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from("users")
            .update({
            paypal_handle: updates.paypal,
            cashapp_handle: updates.cashapp,
            venmo_handle: updates.venmo,
            zelle_handle: updates.zelle,
            chime_handle: updates.chime,
        })
            .eq("id", userId)
            .select()
            .single();
        if (error) {
            throw error;
        }
        res.json(data);
    }
    catch (error) {
        console.error("Error updating payment handles:", error);
        res.status(500).json({ error: "Failed to update payment handles" });
    }
});
// Update stream keys (encrypted)
app.put("/api/users/:userId/stream-keys", async (req, res) => {
    try {
        const { userId } = req.params;
        const { platform, streamKey } = req.body;
        // Encrypt the stream key
        const cipher = crypto_1.default.createCipher("aes-256-cbc", ENCRYPTION_KEY);
        let encrypted = cipher.update(streamKey, "utf8", "hex");
        encrypted += cipher.final("hex");
        const columnName = `${platform}_stream_key`;
        const { data, error } = await supabase
            .from("users")
            .update({ [columnName]: encrypted })
            .eq("id", userId)
            .select()
            .single();
        if (error) {
            throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error updating stream key:", error);
        res.status(500).json({ error: "Failed to update stream key" });
    }
});
// ============================================
// SOCKET.IO HANDLERS
// ============================================
io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    // Join stream room
    socket.on("join-stream", async ({ streamId, userId, isHost }) => {
        try {
            socket.join(streamId);
            if (!isHost) {
                await streamManager.addViewer(streamId, userId || socket.id);
            }
            // Get RTP capabilities for the room
            const router = await mediasoupManager.createRouter(streamId);
            socket.emit("joined-stream", {
                streamId,
                rtpCapabilities: router.rtpCapabilities,
            });
            // Notify others
            socket.to(streamId).emit("viewer-joined", {
                userId: userId || socket.id,
                timestamp: new Date().toISOString(),
            });
            console.log(`[Socket] ${socket.id} joined stream: ${streamId}`);
        }
        catch (error) {
            console.error("[Socket] Error joining stream:", error);
            socket.emit("error", { message: "Failed to join stream" });
        }
    });
    // Leave stream room
    socket.on("leave-stream", async ({ streamId, userId }) => {
        try {
            socket.leave(streamId);
            await streamManager.removeViewer(streamId, userId || socket.id);
            socket.to(streamId).emit("viewer-left", {
                userId: userId || socket.id,
                timestamp: new Date().toISOString(),
            });
            console.log(`[Socket] ${socket.id} left stream: ${streamId}`);
        }
        catch (error) {
            console.error("[Socket] Error leaving stream:", error);
        }
    });
    // WebRTC Signaling - Connect Transport
    socket.on("connect-transport", async ({ streamId, transportId, dtlsParameters }, callback) => {
        try {
            const transport = mediasoupManager["transports"]?.get(`${streamId}:${transportId}`);
            if (!transport) {
                return callback({ error: "Transport not found" });
            }
            await transport.connect({ dtlsParameters });
            callback({ success: true });
        }
        catch (error) {
            console.error("[Socket] Error connecting transport:", error);
            callback({ error: error.message });
        }
    });
    // WebRTC Signaling - Produce
    socket.on("produce", async ({ streamId, transportId, kind, rtpParameters }, callback) => {
        try {
            const producer = await mediasoupManager.createProducer(`${streamId}:${transportId}`, kind, rtpParameters);
            callback({ producerId: producer.id });
            // Notify all clients in the room about the new producer
            socket.to(streamId).emit("new-producer", {
                producerId: producer.id,
                kind,
                socketId: socket.id,
            });
        }
        catch (error) {
            console.error("[Socket] Error producing:", error);
            callback({ error: error.message });
        }
    });
    // WebRTC Signaling - Consume
    socket.on("consume", async ({ streamId, transportId, producerId, rtpCapabilities }, callback) => {
        try {
            const consumer = await mediasoupManager.createConsumer(`${streamId}:${transportId}`, producerId, rtpCapabilities);
            if (!consumer) {
                return callback({ error: "Cannot consume" });
            }
            callback({
                consumerId: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        }
        catch (error) {
            console.error("[Socket] Error consuming:", error);
            callback({ error: error.message });
        }
    });
    // Chat message with AI moderation
    socket.on("chat-message", async ({ streamId, message, userId, username }) => {
        try {
            // AI Moderation
            const moderation = await swaniAI.moderateMessage(message, {
                streamId,
                userId,
                username,
            });
            // Store message in database
            const { data, error } = await supabase
                .from("chat_messages")
                .insert({
                stream_id: streamId,
                user_id: userId,
                message: moderation.action === "delete" ? "[Message removed]" : message,
                ai_moderated: true,
                ai_confidence: moderation.confidence,
                ai_action: moderation.action,
                is_deleted: moderation.action === "delete",
            })
                .select()
                .single();
            if (error) {
                throw error;
            }
            // Broadcast message (or moderation notice)
            if (moderation.action === "delete") {
                socket.emit("message-rejected", {
                    reason: moderation.reason,
                    confidence: moderation.confidence,
                });
            }
            else {
                io.to(streamId).emit("chat-message", {
                    id: data.id,
                    userId,
                    username,
                    message: moderation.action === "flag" ? `[Flagged] ${message}` : message,
                    timestamp: data.created_at,
                });
            }
            // Log flagged messages for review
            if (moderation.action === "flag") {
                console.log(`[Moderation] Flagged message in stream ${streamId}: ${message.substring(0, 50)}...`);
            }
        }
        catch (error) {
            console.error("[Socket] Error handling chat message:", error);
            socket.emit("error", { message: "Failed to send message" });
        }
    });
    // Guest panel management
    socket.on("join-as-guest", async ({ streamId, userId, gridPosition }) => {
        try {
            const guestId = await streamManager.addGuest(streamId, userId, gridPosition);
            socket.emit("guest-assigned", {
                guestId,
                gridPosition,
            });
            // Notify host and other viewers
            socket.to(streamId).emit("guest-joined-panel", {
                guestId,
                userId,
                gridPosition,
            });
            console.log(`[Socket] Guest ${userId} joined panel at position ${gridPosition} in stream ${streamId}`);
        }
        catch (error) {
            console.error("[Socket] Error joining as guest:", error);
            socket.emit("error", { message: error.message });
        }
    });
    socket.on("leave-as-guest", async ({ streamId, guestId }) => {
        try {
            await streamManager.removeGuest(streamId, guestId);
            socket.to(streamId).emit("guest-left-panel", {
                guestId,
            });
            console.log(`[Socket] Guest ${guestId} left panel in stream ${streamId}`);
        }
        catch (error) {
            console.error("[Socket] Error leaving as guest:", error);
        }
    });
    // Host controls
    socket.on("mute-guest", ({ streamId, guestId }) => {
        socket.to(streamId).emit("guest-muted", { guestId });
    });
    socket.on("unmute-guest", ({ streamId, guestId }) => {
        socket.to(streamId).emit("guest-unmuted", { guestId });
    });
    socket.on("remove-guest", ({ streamId, guestId }) => {
        socket.to(streamId).emit("guest-removed", { guestId });
    });
    // Watch party sync (Basic)
    socket.on("sync-watch-party", ({ streamId, timestamp, isPlaying }) => {
        socket.to(streamId).emit("watch-party-sync", {
            timestamp,
            isPlaying,
            senderId: socket.id,
        });
    });
    // Watch Party v2 (Advanced)
    socket.on("join-watch-party", async ({ partyId, userId }) => {
        try {
            socket.join(`party:${partyId}`);
            const party = await watchPartyManager.joinParty(partyId, userId, socket.id);
            socket.emit("watch-party-joined", {
                partyId,
                playback: party.playback,
                participants: Array.from(party.participants.entries()).map((item) => ({
                    userId: item[0],
                    isReady: item[1].isReady,
                    status: item[1].status,
                })),
            });
            socket.to(`party:${partyId}`).emit("participant-joined", {
                userId,
                timestamp: new Date().toISOString(),
            });
            console.log(`[Socket] User ${userId} joined watch party ${partyId}`);
        }
        catch (error) {
            console.error('[Socket] Error joining watch party:', error);
            socket.emit('error', { message: error.message });
        }
    });
    socket.on("watch-party-sync-playback", ({ partyId, currentTime, isPlaying }) => {
        watchPartyManager.updatePlayback(partyId, currentTime, isPlaying);
        socket.to(`party:${partyId}`).emit("playback-updated", {
            currentTime,
            isPlaying,
            senderId: socket.id,
        });
    });
    socket.on("watch-party-ready-status", async ({ partyId, userId, isReady }) => {
        await watchPartyManager.setReadyStatus(partyId, userId, isReady);
        io.to(`party:${partyId}`).emit("participant-ready-change", {
            userId,
            isReady,
        });
    });
    // AI Assistance in Watch Party
    socket.on("ask-party-ai", async ({ partyId, prompt, userId: _userId, username, model }) => {
        try {
            // Get context (last messages or current video info)
            const context = { partyId, triggerUser: username };
            const aiResponse = await swaniAI.askAI(prompt, context, model);
            io.to(`party:${partyId}`).emit("ai-response", {
                message: aiResponse,
                model: model || "default",
                userId: "swani-ai",
                username: "SWANI AI",
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error("[Socket] AI error in watch party:", error);
        }
    });
    // Payment notification (for live display)
    socket.on("payment-sent", ({ streamId, amount, senderName, message }) => {
        socket.to(streamId).emit("payment-notification", {
            amount,
            senderName,
            message,
            timestamp: new Date().toISOString(),
        });
    });
    // Disconnect handler
    socket.on("disconnect", () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});
// ============================================
// STARTUP
// ============================================
async function startServer() {
    try {
        // Initialize Mediasoup
        await mediasoupManager.initialize(2);
        // Start HTTP server
        httpServer.listen(PORT, HOST, () => {
            console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           CY Platform - Live Streaming Server              ║
║                                                            ║
║   ✓ Zero-Fee Payment System                               ║
║   ✓ Cross-Platform RTMP Fan-out                           ║
║   ✓ 20-Guest Gold Board Grid                              ║
║   ✓ Mediasoup WebRTC SFU                                  ║
║   ✓ SWANI AI Moderation                                   ║
║                                                            ║
║   Server running on http://${HOST}:${PORT}                  ║
║   Environment: ${NODE_ENV}                                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully...");
    // Close all active streams
    for (const streamId of streamManager
        .getAllActiveStreams()
        .map((s) => s.streamId)) {
        await streamManager.endStream(streamId);
    }
    httpServer.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down gracefully...");
    for (const streamId of streamManager
        .getAllActiveStreams()
        .map((s) => s.streamId)) {
        await streamManager.endStream(streamId);
    }
    httpServer.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
// Start the server
startServer();
//# sourceMappingURL=server.js.map