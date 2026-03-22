import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import * as mediasoup from "mediasoup";
import ffmpeg from "fluent-ffmpeg";
import { EventEmitter } from "events";
import * as crypto from "node:crypto";
import dotenv from "dotenv";
import prisma from "./prisma";
import { authMiddleware, requireAuth } from "./auth";
import Stripe from "stripe";
import Mux from "@mux/mux-node";

dotenv.config();

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================
// SEEWHY LIVE - IMMUTABLE BUSINESS CONSTANTS
// DO NOT CHANGE - These values are contractual
// ============================================
const PLATFORM_FEE_PCT = 0.10;      // 10% platform fee, creator keeps 90%
const PREVIEW_SECONDS = 120;         // Free preview before paywall
const BCRYPT_COST = 12;              // Password hashing rounds
const JWT_ACCESS_TTL = 900;          // 15 minutes in seconds
const JWT_REFRESH_TTL = 604800;      // 7 days in seconds

/**
 * Calculate the 90/10 revenue split for any transaction
 * All values are in CENTS (integers) to avoid floating point errors
 * Uses Math.floor() to ensure platform never overcharges
 * 
 * @param totalCents - Total transaction amount in cents
 * @returns Object with platformCents, creatorCents, and fee percentage
 */
function calculateRevenueSplit(totalCents: number): {
  platformCents: number;
  creatorCents: number;
  platformFeePct: number;
  totalCents: number;
} {
  // IMMUTABLE: Platform takes 10%, creator keeps 90%
  const platformCents = Math.floor(totalCents * PLATFORM_FEE_PCT);
  const creatorCents = totalCents - platformCents;
  
  return {
    platformCents,
    creatorCents,
    platformFeePct: PLATFORM_FEE_PCT,
    totalCents
  };
}

/**
 * Format cents to dollars for display
 */
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

// SDK Initializations
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "placeholder_stripe_secret_key",
  {
    apiVersion: "2023-10-16" as any,
  },
);

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID || "placeholder",
  tokenSecret: process.env.MUX_TOKEN_SECRET || "placeholder",
});

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

const app = express();
const httpServer = createServer(app);
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://srv1327929.hstgr.cloud",
  "http://76.13.31.91",
];

const io = new Server(httpServer, {
  cors: {
    
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Prisma Client (initialized in prisma.ts)

// ============================================
// MIDDLEWARE
// ============================================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        mediasoup:
          mediasoupManager.workers.length > 0 ? "running" : "initializing",
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: "degraded", error: err.message });
  }
});
// ============================================
// WEBHOOKS (Raw Body Required)
// ============================================

// Stripe Webhook
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || "",
      );
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (metadata && metadata.videoPostId) {
        // Calculate 90/10 revenue split (all values in cents)
        const totalCents = session.amount_total || 0;
        const split = calculateRevenueSplit(totalCents);
        
        // Record purchase in DB with split details
        await prisma.payment.create({
          data: {
            amount: split.totalCents / 100, // Store in dollars for legacy compatibility
            currency: session.currency || "usd",
            userId: metadata.buyerId,
            recipientId: metadata.creatorId,
            type: "MARKETPLACE_PURCHASE",
            paymentMethod: "stripe",
            status: "COMPLETED",
            stripeSessionId: session.id,
            // 90/10 Split - PLATFORM_FEE_PCT = 0.10
            platformFee: split.platformCents / 100, // Platform gets 10%
          },
        });

        console.log(
          `[SeeWhy LIVE] Purchase confirmed for post ${metadata.videoPostId}`,
          `| Total: $${centsToDollars(split.totalCents)}`,
          `| Creator: $${centsToDollars(split.creatorCents)} (90%)`,
          `| Platform: $${centsToDollars(split.platformCents)} (10%)`
        );
      }
    }

    res.json({ received: true });
  },
);

// Mux Webhook
app.post("/api/webhooks/mux", express.json(), async (req, res) => {
  const { type, data } = req.body;

  if (type === "video.asset.ready") {
    const assetId = data.id;
    const playbackId = data.playback_ids?.[0]?.id;

    if (playbackId) {
      // Update video post status to active/ready
      await prisma.videoPost.updateMany({
        where: { muxAssetId: assetId },
        data: {
          videoUrl: `https://stream.mux.com/${playbackId}.m3u8`,
          thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
          status: "READY",
        },
      });
      console.log(`[Mux] Asset ${assetId} is now READY`);
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);
app.use(authMiddleware); // Apply global mock auth middleware

// Middleware to ensuring creator exists in DB
const ensureCreator = async (req: any, res: any, next: any) => {
  const auth = req.auth;
  if (auth?.userId) {
    try {
      let creator = await prisma.creator.findUnique({
        where: { clerkId: auth.userId },
      });

      if (!creator) {
        // Auto-provision creator
        // Clerk session typically includes email in sessionClaims or userEmail
        const email =
          auth.sessionClaims?.email ||
          auth.userEmail ||
          `user_${auth.userId}@temporary.com`;
        const handle =
          email.split("@")[0].toLowerCase() + Math.floor(Math.random() * 1000);

        creator = await prisma.creator.create({
          data: {
            clerkId: auth.userId,
            email: email,
            handle: handle,
            displayName: handle.toUpperCase(),
            plan: "FREE",
          },
        });
        console.log(`[Auth] Auto-provisioned creator: ${handle}`);
      }
      req.creator = creator;
    } catch (error) {
      console.error("[Auth] Error provisioning creator:", error);
    }
  }
  next();
};
app.use(ensureCreator);

// ============================================
// MEDIASOUP SFU MANAGER
// ============================================

class MediasoupManager extends EventEmitter {
  public workers: mediasoup.types.Worker[] = [];
  public routers: Map<string, mediasoup.types.Router> = new Map();
  public transports: Map<string, mediasoup.types.WebRtcTransport> = new Map();
  public producers: Map<string, mediasoup.types.Producer> = new Map();
  public consumers: Map<string, mediasoup.types.Consumer> = new Map();
  public plainTransports: Map<string, mediasoup.types.PlainTransport> =
    new Map();
  private nextWorkerIndex = 0;

  async initialize(numWorkers = 2) {
    console.log(`[Mediasoup] Initializing ${numWorkers} workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker(
        MEDIASOUP_CONFIG.worker as mediasoup.types.WorkerSettings,
      );

      worker.on("died", () => {
        console.error(`[Mediasoup] Worker ${i} died, restarting...`);
        this.restartWorker(i);
      });

      this.workers.push(worker);
    }

    console.log("[Mediasoup] All workers initialized successfully");
  }

  private async restartWorker(index: number) {
    const worker = await mediasoup.createWorker(
      MEDIASOUP_CONFIG.worker as mediasoup.types.WorkerSettings,
    );
    this.workers[index] = worker;
    console.log(`[Mediasoup] Worker ${index} restarted`);
  }

  private getNextWorker(): mediasoup.types.Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRouter(roomId: string): Promise<mediasoup.types.Router> {
    if (this.routers.has(roomId)) {
      return this.routers.get(roomId)!;
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: MEDIASOUP_CONFIG.router
        .mediaCodecs as mediasoup.types.RtpCodecCapability[],
    });

    this.routers.set(roomId, router);
    console.log(`[Mediasoup] Router created for room: ${roomId}`);

    return router;
  }

  async createWebRtcTransport(
    roomId: string,
    peerId: string,
  ): Promise<mediasoup.types.WebRtcTransport> {
    const router = await this.createRouter(roomId);

    const transport = await router.createWebRtcTransport(
      MEDIASOUP_CONFIG.webRtcTransport,
    );

    const transportId = `${roomId}:${peerId}`;
    this.transports.set(transportId, transport);

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
        this.transports.delete(transportId);
      }
    });

    console.log(
      `[Mediasoup] WebRTC Transport created for peer: ${peerId} in room: ${roomId}`,
    );

    return transport;
  }

  async createPlainRtpTransport(
    roomId: string,
  ): Promise<mediasoup.types.PlainTransport> {
    const router = await this.createRouter(roomId);

    const transport = await router.createPlainTransport({
      listenIp: {
        ip: "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
      },
      rtcpMux: false,
      comedia: true,
    });

    this.plainTransports.set(`${roomId}:plain`, transport);

    console.log(`[Mediasoup] Plain RTP Transport created for room: ${roomId}`);
    return transport;
  }

  async createProducer(
    transportId: string,
    kind: mediasoup.types.MediaKind,
    rtpParameters: any,
  ): Promise<mediasoup.types.Producer> {
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

  async createConsumer(
    transportId: string,
    producerId: string,
    rtpCapabilities: any,
  ): Promise<mediasoup.types.Consumer | null> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producer = this.producers.get(producerId);
    if (!producer) {
      return null;
    }

    if (
      !(transport as any).router?.rtpCapabilities ||
      !(transport as any).router?.canConsume({ producerId, rtpCapabilities })
    ) {
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

    console.log(
      `[Mediasoup] Consumer created: ${consumer.id} for producer: ${producerId}`,
    );

    return consumer;
  }

  getRouter(roomId: string): mediasoup.types.Router | undefined {
    return this.routers.get(roomId);
  }

  getProducer(producerId: string): mediasoup.types.Producer | undefined {
    return this.producers.get(producerId);
  }

  closeRoom(roomId: string) {
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

class RTMPFanOutManager extends EventEmitter {
  private ffmpegProcesses: Map<string, any> = new Map();
  private activeStreams: Map<string, Set<string>> = new Map();

  async startFanOut(streamId: string, platforms: string[], streamKey: string) {
    console.log(
      `[RTMP] Starting fan-out for stream: ${streamId} to platforms: ${platforms.join(", ")}`,
    );

    if (!this.activeStreams.has(streamId)) {
      this.activeStreams.set(streamId, new Set());
    }

    const activePlatforms = this.activeStreams.get(streamId)!;

    for (const platform of platforms) {
      if (activePlatforms.has(platform)) {
        console.log(
          `[RTMP] Already streaming to ${platform} for stream: ${streamId}`,
        );
        continue;
      }

      const config = RTMP_CONFIG[platform as keyof typeof RTMP_CONFIG];
      if (!config || !config.enabled) {
        console.warn(`[RTMP] Platform ${platform} not configured or disabled`);
        continue;
      }

      await this.startPlatformStream(streamId, platform, config.url, streamKey);
      activePlatforms.add(platform);
    }
  }

  private async startPlatformStream(
    streamId: string,
    platform: string,
    rtmpUrl: string,
    streamKey: string,
  ) {
    const processId = `${streamId}:${platform}`;

    // Get creator's encrypted stream key for this platform
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      include: { creator: true },
    });

    if (!stream || !stream.creator) {
      console.error(`[RTMP] Failed to get stream/creator for ${platform}`);
      return;
    }

    const keyField = `${platform}StreamKey` as keyof typeof stream.creator;
    const encryptedKey = stream.creator[keyField] as string;

    if (!encryptedKey) {
      console.warn(`[RTMP] No stream key configured for ${platform}`);
      return;
    }

    const platformStreamKey = this.decryptStreamKey(encryptedKey);
    const fullRtmpUrl = `${rtmpUrl}${platformStreamKey}`;

    console.log(`[RTMP] Starting FFmpeg to ${platform}: ${rtmpUrl}***`);

    const ffmpegProcess = ffmpeg()
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
    await prisma.rtmpRelay.upsert({
      where: {
        streamId_platform: {
          streamId: streamId,
          platform: platform,
        },
      },
      update: {
        status: "active",
        connectionStartedAt: new Date(),
        lastError: null,
      },
      create: {
        streamId: streamId,
        platform: platform,
        status: "active",
        connectionStartedAt: new Date(),
      },
    });
  }

  private decryptStreamKey(encryptedKey: string): string {
    try {
      // In production, use a real encryption key from environment
      const ENCRYPTION_KEY =
        process.env.STREAM_ENCRYPTION_KEY || "fallback_secret";
      const decipher = crypto.createDecipher("aes-256-cbc", ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedKey, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error: any) {
      console.error("[RTMP] Failed to decrypt stream key:", error);
      return "";
    }
  }

  private async handleStreamError(
    streamId: string,
    platform: string,
    error: string,
  ) {
    console.error(`[RTMP] Stream error for ${platform}:`, error);

    await prisma.rtmpRelay.upsert({
      where: {
        streamId_platform: {
          streamId: streamId,
          platform: platform,
        },
      },
      update: {
        status: "error",
        lastError: error,
        connectionEndedAt: new Date(),
      },
      create: {
        streamId: streamId,
        platform: platform,
        status: "error",
        lastError: error,
        connectionEndedAt: new Date(),
      },
    });

    this.emit("streamError", { streamId, platform, error });
  }

  async stopPlatformStream(streamId: string, platform: string) {
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
    await prisma.rtmpRelay.updateMany({
      where: {
        streamId: streamId,
        platform: platform,
      },
      data: {
        status: "inactive",
        connectionEndedAt: new Date(),
      },
    });

    console.log(
      `[RTMP] Stopped streaming to ${platform} for stream: ${streamId}`,
    );
  }

  async stopAllStreams(streamId: string) {
    const activePlatforms = this.activeStreams.get(streamId);
    if (activePlatforms) {
      for (const platform of activePlatforms) {
        await this.stopPlatformStream(streamId, platform);
      }
      this.activeStreams.delete(streamId);
    }
    console.log(`[RTMP] All streams stopped for: ${streamId}`);
  }

  getActiveStreams(): Map<string, Set<string>> {
    return this.activeStreams;
  }
}

const rtmpManager = new RTMPFanOutManager();

// ============================================
// INGEST & BRIDGE MANAGER (RTMP -> WebRTC)
// ============================================

class IngestManager extends EventEmitter {
  private ingests: Map<string, any> = new Map();

  async startIngestBridge(streamId: string, streamKey: string) {
    console.log(`[Ingest] Starting bridge for stream ${streamId}`);

    try {
      const router = await mediasoupManager.createRouter(streamId);

      // 1. Create a PlainRtpTransport for the stream
      const transport = await router.createPlainTransport({
        listenIp: {
          ip: "0.0.0.0",
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
        },
        rtcpMux: false,
        comedia: true,
      });

      // 2. Create Producers for Video and Audio
      // We manually define RTP parameters that FFmpeg will follow
      const videoProducer = await transport.produce({
        kind: "video",
        rtpParameters: {
          codecs: [
            {
              mimeType: "video/H264",
              clockRate: 90000,
              payloadType: 101,
              parameters: {
                "packetization-mode": 1,
                "profile-level-id": "4d0032",
              },
            },
          ],
          encodings: [{ ssrc: 11111111 }],
        },
      });

      const audioProducer = await transport.produce({
        kind: "audio",
        rtpParameters: {
          codecs: [
            {
              mimeType: "audio/opus",
              clockRate: 48000,
              payloadType: 100,
              channels: 2,
            },
          ],
          encodings: [{ ssrc: 22222222 }],
        },
      });

      // Notify the room about the host's bridge producer
      io.to(streamId).emit("new-producer", {
        producerId: videoProducer.id,
        kind: "video",
        socketId: "server-ingest",
      });
      io.to(streamId).emit("new-producer", {
        producerId: audioProducer.id,
        kind: "audio",
        socketId: "server-ingest",
      });

      // 3. Spawning FFmpeg to pull from RTMP and push to Mediasoup
      const rtmpUrl = `rtmp://rtmp:1935/live/${streamKey}`;

      const ffmpegProcess = ffmpeg(rtmpUrl)
        .inputOptions(["-re"])
        .outputOptions([
          "-map 0:v:0",
          "-c:v copy",
          "-f rtp",
          "-payload_type 101",
          "-ssrc 11111111",
          `rtp://${transport.tuple.localIp}:${transport.tuple.localPort}`,
          "-map 0:a:0",
          "-c:a libopus",
          "-b:a 128k",
          "-ac 2",
          "-ar 48000",
          "-f rtp",
          "-payload_type 100",
          "-ssrc 22222222",
          `rtp://${transport.tuple.localIp}:${transport.rtcpTuple?.localPort || 5005}`,
        ]);

      ffmpegProcess.on("start", () => {
        console.log(`[Ingest] FFmpeg bridge active for ${streamId}`);
      });

      ffmpegProcess.on("error", (err) => {
        console.error(`[Ingest] FFmpeg bridge error: ${err.message}`);
      });

      this.ingests.set(streamId, {
        process: ffmpegProcess,
        videoProducer,
        audioProducer,
        transport,
      });

      ffmpegProcess.run();
    } catch (error) {
      console.error(`[Ingest] Failed to start bridge: ${error}`);
    }
  }

  stopIngestBridge(streamId: string) {
    const ingest = this.ingests.get(streamId);
    if (ingest) {
      ingest.process.kill("SIGINT");
      ingest.videoProducer.close();
      ingest.audioProducer.close();
      ingest.transport.close();
      this.ingests.delete(streamId);
      console.log(`[Ingest] Bridge stopped for stream ${streamId}`);
    }
  }
}

const ingestManager = new IngestManager();

// ============================================
// SWANI AI WRAPPER (Enhanced)
// ============================================

class SwaniAIWrapper {
  private apiKey: string;
  private defaultModel: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    this.defaultModel = process.env.LLM_MODEL || "anthropic/claude-3.5-sonnet";
    this.apiUrl = "https://openrouter.ai/api/v1/chat/completions";
  }

  async moderateMessage(
    message: string,
    context: any = {},
  ): Promise<{
    action: "allow" | "flag" | "delete";
    confidence: number;
    reason?: string;
  }> {
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

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data: any = await response.json();
      const content = data.choices[0]?.message?.content || "";
      const result = JSON.parse(content);
      return {
        action: result.action || "allow",
        confidence: result.confidence || 0.5,
        reason: result.reason,
      };
    } catch (error: any) {
      console.error("[SwaniAI] Moderation error:", error);
      return {
        action: "allow",
        confidence: 0.0,
        reason: "AI moderation failed",
      };
    }
  }

  async askAI(
    prompt: string,
    context: any = {},
    model?: string,
  ): Promise<string> {
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
              content:
                "You are an AI assistant integrated into a live streaming and watch party platform. Provide helpful, concise, and engaging responses.",
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

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data: any = await response.json();
      return data.choices[0]?.message?.content || "";
    } catch (error: any) {
      console.error("[SwaniAI] AI Ask error:", error);
      return "I am sorry, I am having trouble connecting to my brain right now.";
    }
  }

  async compressMessage(
    message: string,
    maxLength: number = 200,
  ): Promise<string> {
    if (message.length <= maxLength) return message;
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
      if (!response.ok) return message.substring(0, maxLength) + "...";
      const data: any = await response.json();
      return (
        data.choices[0]?.message?.content ||
        message.substring(0, maxLength) + "..."
      );
    } catch (error: any) {
      return message.substring(0, maxLength) + "...";
    }
  }
}

const swaniAI = new SwaniAIWrapper();

// ============================================
// WATCH PARTY MANAGER
// ============================================

class WatchPartyManager extends EventEmitter {
  private activeParties: Map<string, any> = new Map();

  async createParty(hostId: string, partyData: any) {
    const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    const data = await prisma.watchParty.create({
      data: {
        hostId: hostId,
        title: partyData.title,
        description: partyData.description,
        videoUrl: partyData.videoUrl,
        videoSource: partyData.videoSource || "youtube",
        videoId: partyData.videoId,
        inviteCode: inviteCode,
        visibility: (partyData.visibility?.toUpperCase() as any) || "PUBLIC",
        status: "active",
      },
    });

    this.activeParties.set(data.id, {
      hostId,
      inviteCode,
      participants: new Map(),
      playback: {
        currentTime: 0,
        isPlaying: false,
        lastUpdated: Date.now(),
      },
      videoUrl: partyData.videoUrl,
      title: partyData.title,
    });

    return data;
  }

  async joinParty(partyId: string, userId: string, socketId: string) {
    const party = this.activeParties.get(partyId);
    if (!party) {
      const data = await prisma.watchParty.findUnique({
        where: { id: partyId },
      });
      if (!data) throw new Error("Watch party not found");

      this.activeParties.set(data.id, {
        hostId: data.hostId,
        inviteCode: data.inviteCode,
        participants: new Map(),
        playback: {
          currentTime: data.currentTimeSeconds || 0,
          isPlaying: data.isPlaying,
          lastUpdated: Date.now(),
        },
        videoUrl: data.videoUrl,
        title: data.title,
      });
    }

    await prisma.watchPartyParticipant.upsert({
      where: {
        watchPartyId_userId: {
          watchPartyId: partyId,
          userId: userId,
        },
      },
      update: { status: "connected" },
      create: {
        watchPartyId: partyId,
        userId: userId,
        status: "connected",
      },
    });

    const currentParty = this.activeParties.get(partyId);
    currentParty.participants.set(userId, {
      socketId,
      isReady: false,
      status: "connected",
    });

    return currentParty;
  }

  async setReadyStatus(partyId: string, userId: string, isReady: boolean) {
    const party = this.activeParties.get(partyId);
    if (party) {
      const participant = party.participants.get(userId);
      if (participant) {
        participant.isReady = isReady;

        await prisma.watchPartyParticipant.update({
          where: {
            watchPartyId_userId: {
              watchPartyId: partyId,
              userId: userId,
            },
          },
          data: {
            isReady: isReady,
            status: isReady ? "ready" : "connected",
          },
        });

        return true;
      }
    }
    return false;
  }

  updatePlayback(partyId: string, currentTime: number, isPlaying: boolean) {
    const party = this.activeParties.get(partyId);
    if (party) {
      party.playback = {
        currentTime,
        isPlaying,
        lastUpdated: Date.now(),
      };
    }
  }

  getPartyByInviteCode(inviteCode: string) {
    return Array.from(this.activeParties.values()).find(
      (p) => p.inviteCode === inviteCode,
    );
  }

  removeParticipant(partyId: string, userId: string) {
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

class StreamManager extends EventEmitter {
  private activeStreams: Map<string, any> = new Map();

  async createStream(hostId: string, streamData: any) {
    const data = await prisma.stream.create({
      data: {
        creatorId: hostId,
        title: streamData.title,
        description: streamData.description,
        category: (streamData.category?.toUpperCase() as any) || "OTHER",
        visibility: (streamData.visibility?.toUpperCase() as any) || "PUBLIC",
        scheduledAt: streamData.scheduledStart
          ? new Date(streamData.scheduledStart)
          : null,
        status: "SCHEDULED",
        streamKey: crypto.randomBytes(16).toString("hex"),
      },
    });

    return data;
  }

  async goLive(streamId: string, platforms: string[] = []) {
    const stream = await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: "LIVE",
        startedAt: new Date(),
      },
      include: { creator: true },
    });

    if (!stream) {
      throw new Error("Failed to start stream");
    }

    // Initialize Mediasoup router for this stream
    await mediasoupManager.createRouter(streamId);

    // Start RTMP fan-out to platforms
    if (platforms.length > 0) {
      await rtmpManager.startFanOut(streamId, platforms, stream.streamKey);
    }

    this.activeStreams.set(streamId, {
      hostId: stream.creatorId,
      startTime: new Date(),
      viewers: new Set(),
      guests: new Map(),
      maxViewers: 0,
    });

    this.emit("streamStarted", { streamId, hostId: stream.creatorId });

    return stream;
  }

  async endStream(streamId: string) {
    try {
      await prisma.stream.update({
        where: { id: streamId },
        data: {
          status: "ENDED",
          endedAt: new Date(),
        },
      });
    } catch (error) {
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

  getActiveStream(streamId: string): any {
    return this.activeStreams.get(streamId);
  }

  getAllActiveStreams(): Array<{
    streamId: string;
    hostId: string;
    viewerCount: number;
  }> {
    return Array.from(this.activeStreams.entries()).map(([streamId, data]) => ({
      streamId,
      hostId: data.hostId,
      viewerCount: data.viewers.size,
    }));
  }

  async addViewer(streamId: string, viewerId: string) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.viewers.add(viewerId);

      // Update current viewers count and total views
      await prisma.stream.update({
        where: { id: streamId },
        data: {
          totalViewers: { increment: 1 },
        },
      });

      if (stream.viewers.size > stream.maxViewers) {
        stream.maxViewers = stream.viewers.size;
        await prisma.stream.update({
          where: { id: streamId },
          data: { peakViewers: stream.maxViewers },
        });
      }
    }
  }

  async removeViewer(streamId: string, viewerId: string) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.viewers.delete(viewerId);
    }
  }

  async addGuest(
    streamId: string,
    userId: string,
    gridPosition: number,
  ): Promise<string> {
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      throw new Error("Stream not found");
    }

    // Check if position is available
    for (const [_, guestData] of (
      stream.guests as Map<string, any>
    ).entries()) {
      if (guestData.gridPosition === gridPosition) {
        throw new Error("Grid position already occupied");
      }
    }

    const guestId = crypto.randomUUID();
    stream.guests.set(guestId, {
      userId,
      gridPosition,
      joinedAt: new Date(),
    });

    // Update database
    await prisma.streamGuest.create({
      data: {
        streamId: streamId,
        userId: userId,
        gridPosition: gridPosition,
        status: "connected",
        joinedAt: new Date(),
      },
    });

    this.emit("guestJoined", { streamId, guestId, userId, gridPosition });

    return guestId;
  }

  async removeGuest(streamId: string, guestId: string) {
    const stream = this.activeStreams.get(streamId);
    if (stream && stream.guests.has(guestId)) {
      const guest = stream.guests.get(guestId);
      stream.guests.delete(guestId);

      await prisma.streamGuest.updateMany({
        where: {
          streamId: streamId,
          userId: guest.userId,
          status: "connected",
        },
        data: {
          status: "disconnected",
          leftAt: new Date(),
        },
      });

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
  } catch (error: any) {
    console.error("Error getting RTP capabilities:", error);
    res.status(500).json({ error: "Failed to get RTP capabilities" });
  }
});

// Create WebRTC Transport
app.post("/api/streams/:streamId/transport", async (req, res) => {
  try {
    const { streamId } = req.params;
    const { peerId, direction } = req.body;

    const transport = await mediasoupManager.createWebRtcTransport(
      streamId,
      peerId,
    );

    res.json({
      transportId: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  } catch (error: any) {
    console.error("Error creating transport:", error);
    res.status(500).json({ error: "Failed to create transport" });
  }
});

// Connect Transport
app.post(
  "/api/streams/:streamId/transport/:transportId/connect",
  async (req, res) => {
    try {
      const { streamId, transportId } = req.params;
      const { dtlsParameters } = req.body;

      const transport = mediasoupManager.transports?.get(
        `${streamId}:${transportId}`,
      );
      if (!transport) {
        return res.status(404).json({ error: "Transport not found" });
      }

      await transport.connect({ dtlsParameters });
      res.json({ connected: true });
    } catch (error: any) {
      console.error("Error connecting transport:", error);
      res.status(500).json({ error: "Failed to connect transport" });
    }
  },
);

// Produce (Publish media)
app.post(
  "/api/streams/:streamId/transport/:transportId/produce",
  async (req, res) => {
    try {
      const { streamId, transportId } = req.params;
      const { kind, rtpParameters } = req.body;

      const producer = await mediasoupManager.createProducer(
        `${streamId}:${transportId}`,
        kind,
        rtpParameters,
      );

      res.json({
        producerId: producer.id,
      });
    } catch (error: any) {
      console.error("Error producing:", error);
      res.status(500).json({ error: "Failed to produce" });
    }
  },
);

// Consume (Subscribe to media)
app.post(
  "/api/streams/:streamId/transport/:transportId/consume",
  async (req, res) => {
    try {
      const { streamId, transportId } = req.params;
      const { producerId, rtpCapabilities } = req.body;

      const consumer = await mediasoupManager.createConsumer(
        `${streamId}:${transportId}`,
        producerId,
        rtpCapabilities,
      );

      if (!consumer) {
        return res.status(400).json({ error: "Cannot consume" });
      }

      res.json({
        consumerId: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (error: any) {
      console.error("Error consuming:", error);
      res.status(500).json({ error: "Failed to consume" });
    }
  },
);

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
    const data = await prisma.stream.findMany({
      where: { status: "LIVE" },
      include: {
        creator: {
          select: {
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    res.json(data);
  } catch (error: any) {
    console.error("Error fetching streams:", error);
    res.status(500).json({ error: "Failed to fetch streams" });
  }
});

// Get stream by ID
app.get("/api/streams/:streamId", async (req, res) => {
  try {
    const { streamId } = req.params;

    const data = await prisma.stream.findUnique({
      where: { id: streamId },
      include: {
        creator: {
          select: {
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!data) {
      return res.status(404).json({ error: "Stream not found" });
    }

    res.json(data);
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
    console.error("Error ending stream:", error);
    res.status(500).json({ error: "Failed to end stream" });
  }
});

// ============================================
// CREATOR DASHBOARD API
// ============================================

// Get Creator Profile
app.get("/api/creator/profile", async (req: any, res: any) => {
  try {
    const creator = req.creator;
    if (!creator) return res.status(401).json({ error: "Unauthorized" });

    res.json({
      id: creator.id,
      handle: creator.handle,
      displayName: creator.displayName,
      email: creator.email,
      rtmpKey: creator.rtmpKey,
      rtmpSecret: creator.rtmpSecret,
      plan: creator.plan,
      auraEnabled: creator.auraEnabled,
      auraVoice: creator.auraVoice,
      auraAutoSummary: creator.auraAutoSummary,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Server error fetching profile" });
  }
});

// Update Creator Profile
app.put("/api/creator/profile", async (req: any, res: any) => {
  try {
    const creator = req.creator;
    if (!creator) return res.status(401).json({ error: "Unauthorized" });

    const allowedUpdates = ["displayName", "bio", "auraEnabled", "auraVoice", "auraAutoSummary"];
    const updateData: any = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    const updated = await prisma.creator.update({
      where: { id: creator.id },
      data: updateData,
    });

    res.json({ success: true, creator: updated });
  } catch (error: any) {
    res.status(500).json({ error: "Server error updating profile" });
  }
});

// Generate RTMP Stream Key
app.post("/api/creator/generate-keys", async (req: any, res: any) => {
  try {
    const creator = req.creator;
    if (!creator) return res.status(401).json({ error: "Unauthorized" });

    const newKey = `cy_${creator.id.substring(0, 8)}_${crypto.randomBytes(6).toString("hex")}`;
    const newSecret = crypto.randomBytes(16).toString("hex");

    const updated = await prisma.creator.update({
      where: { id: creator.id },
      data: {
        rtmpKey: newKey,
        rtmpSecret: newSecret,
      },
    });

    res.json({ rtmpKey: updated.rtmpKey, rtmpSecret: updated.rtmpSecret });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate keys" });
  }
});

// Get user payment handles (for donation buttons)
app.get("/api/users/:userId/payment-handles", async (req, res) => {
  try {
    const { userId } = req.params;

    const data = await prisma.creator.findUnique({
      where: { id: userId },
      select: {
        paypalHandle: true,
        cashappHandle: true,
        venmoHandle: true,
        zelleHandle: true,
        chimeHandle: true,
        displayName: true,
      },
    });

    if (!data) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only return handles that are configured
    const handles: Record<string, string> = {};
    if (data.paypalHandle) handles.paypal = data.paypalHandle;
    if (data.cashappHandle) handles.cashapp = data.cashappHandle;
    if (data.venmoHandle) handles.venmo = data.venmoHandle;
    if (data.zelleHandle) handles.zelle = data.zelleHandle;
    if (data.chimeHandle) handles.chime = data.chimeHandle;

    res.json({
      displayName: data.displayName,
      handles,
    });
  } catch (error: any) {
    console.error("Error fetching payment handles:", error);
    res.status(500).json({ error: "Failed to fetch payment handles" });
  }
});

// Update user payment handles
app.put("/api/users/:userId/payment-handles", async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const data = await prisma.creator.update({
      where: { id: userId },
      data: {
        paypalHandle: updates.paypal,
        cashappHandle: updates.cashapp,
        venmoHandle: updates.venmo,
        zelleHandle: updates.zelle,
        chimeHandle: updates.chime,
      },
    });

    res.json(data);
  } catch (error: any) {
    console.error("Error updating payment handles:", error);
    res.status(500).json({ error: "Failed to update payment handles" });
  }
});

// Update stream keys (encrypted)
app.put("/api/users/:userId/stream-keys", async (req, res) => {
  try {
    const { userId } = req.params;
    const { platform, streamKey } = req.body;

    const ENCRYPTION_KEY =
      process.env.STREAM_ENCRYPTION_KEY || "fallback_secret";
    // Encrypt the stream key
    const cipher = crypto.createCipher("aes-256-cbc", ENCRYPTION_KEY);
    let encrypted = cipher.update(streamKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    const keyField = `${platform}StreamKey`;

    const data = await prisma.creator.update({
      where: { id: userId },
      data: { [keyField]: encrypted },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating stream key:", error);
    res.status(500).json({ error: "Failed to update stream key" });
  }
});

// RTMP Webhook: on_publish
app.post("/api/rtmp/on-publish", async (req, res) => {
  const { name: streamKey } = req.body;

  try {
    // Find the stream by key
    const stream = await prisma.stream.findFirst({
      where: { streamKey: streamKey, status: "LIVE" },
    });

    if (!stream) {
      console.warn(
        `[RTMP] Rejecting publish: No active stream found for key ${streamKey}`,
      );
      return res.status(404).json({ error: "Stream not found" });
    }

    console.log(
      `[RTMP] Ingest detected for stream ${stream.id}. Bridging to WebRTC.`,
    );

    // Trigger the WebRTC bridge
    await ingestManager.startIngestBridge(stream.id, streamKey);

    res.status(200).send("OK");
  } catch (error) {
    console.error("[RTMP] Error in on-publish:", error);
    res.status(500).send("Error");
  }
});

app.post("/api/rtmp/on-publish-done", async (req, res) => {
  const { name: streamKey } = req.body;

  try {
    const stream = await prisma.stream.findFirst({
      where: { streamKey: streamKey },
    });

    if (stream) {
      console.log(
        `[RTMP] Stream stopped for key ${streamKey}. Stopping bridge.`,
      );
      ingestManager.stopIngestBridge(stream.id);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("[RTMP] Error in on-publish-done:", error);
    res.status(500).send("Error");
  }
});

// ============================================
// CREATOR MONETIZATION (STRIPE & MUX)
// ============================================

// Stripe Connect - Create Account Link
app.post("/api/creators/onboard", requireAuth, async (req: any, res: any) => {
  try {
    const creator = req.creator;

    // Create connect account if not exists
    let stripeAccountId = creator.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: creator.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;
      await prisma.creator.update({
        where: { id: creator.id },
        data: { stripeAccountId },
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${process.env.FRONTEND_URL}/dashboard?onboarding=refresh`,
      return_url: `${process.env.FRONTEND_URL}/dashboard?onboarding=complete`,
      type: "account_onboarding",
    });

    res.json({
      url: accountLink.url,
      success: true,
    });
  } catch (error: any) {
    console.error("[Stripe] Onboarding Error:", error);
    res.status(500).json({ error: "Failed to create Stripe onboarding link" });
  }
});

// Mux - Create Asset/Upload URL
app.post(
  "/api/creators/upload-url",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const upload = await mux.video.uploads.create({
        cors_origin: "*",
        new_asset_settings: {
          playback_policy: ["public"],
        },
      });

      res.json({
        uploadUrl: upload.url,
        id: upload.id,
      });
    } catch (error: any) {
      console.error("[Mux] Upload Error:", error);
      res.status(500).json({ error: "Failed to create Mux upload URL" });
    }
  },
);

// Marketplace Checkout Session
app.post(
  "/api/marketplace/create-checkout",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const { videoPostId } = req.body;
      const post = await prisma.videoPost.findUnique({
        where: { id: videoPostId },
        include: { creator: true },
      });

      if (!post || !post.creator.stripeAccountId) {
        return res.status(404).json({ error: "Post or Creator not found" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: post.title,
                description: post.description || undefined,
              },
              unit_amount: Math.round(Number(post.price) * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          videoPostId: post.id,
          buyerId: req.auth.userId, // Clerk ID of buyer
          creatorId: post.creatorId, // Internal ID of seller
        },
        success_url: `${process.env.FRONTEND_URL}/marketplace?purchase_success=true&id=${post.id}`,
        cancel_url: `${process.env.FRONTEND_URL}/marketplace?purchase_cancel=true`,
        payment_intent_data: {
          application_fee_amount: 0, // Zero fee platform
          transfer_data: {
            destination: post.creator.stripeAccountId,
          },
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("[Stripe] Checkout Error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  },
);

// ============================================
// MARKETPLACE ROUTES
// ============================================

// Get all marketplace video posts
app.get("/api/marketplace", async (req, res) => {
  try {
    const data = await prisma.videoPost.findMany({
      include: {
        creator: {
          select: {
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(data);
  } catch (error: any) {
    console.error("Error fetching marketplace:", error);
    res.status(500).json({ error: "Failed to fetch marketplace" });
  }
});

// Create new marketplace video post
app.post("/api/marketplace", async (req, res) => {
  try {
    const {
      userId,
      title,
      description,
      videoUrl,
      thumbnailUrl,
      price,
      isForSale,
      muxAssetId, // From Mux upload logic
    } = req.body;

    const data = await prisma.videoPost.create({
      data: {
        creatorId: userId,
        title,
        description,
        videoUrl,
        thumbnailUrl,
        price: parseFloat(price),
        isForSale: Boolean(isForSale),
        status: muxAssetId ? "PROCESSING" : "READY",
        muxAssetId,
      },
    });

    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error creating marketplace post:", error);
    res.status(500).json({ error: "Failed to create marketplace post" });
  }
});

// Purchase a video post
app.post("/api/marketplace/purchase", async (req, res) => {
  try {
    const { videoPostId, buyerId, amount, paymentMethod, transactionId } =
      req.body;

    // Get seller ID from video post
    const videoPost = await prisma.videoPost.findUnique({
      where: { id: videoPostId },
      select: { creatorId: true },
    });

    if (!videoPost) throw new Error("Video post not found");

    const data = await prisma.marketplacePurchase.create({
      data: {
        videoPostId: videoPostId,
        buyerId: buyerId,
        sellerId: videoPost.creatorId,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod,
        transactionId: transactionId,
        status: "completed",
      },
    });

    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error recording purchase:", error);
    res.status(500).json({ error: "Failed to record purchase" });
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error("[Socket] Error leaving stream:", error);
    }
  });

  // WebRTC Signaling - Connect Transport
  socket.on(
    "connect-transport",
    async ({ streamId, transportId, dtlsParameters }, callback) => {
      try {
        const transport = mediasoupManager["transports"]?.get(
          `${streamId}:${transportId}`,
        );
        if (!transport) {
          return callback({ error: "Transport not found" });
        }

        await transport.connect({ dtlsParameters });
        callback({ success: true });
      } catch (error: any) {
        console.error("[Socket] Error connecting transport:", error);
        callback({ error: error.message });
      }
    },
  );

  // WebRTC Signaling - Produce
  socket.on(
    "produce",
    async ({ streamId, transportId, kind, rtpParameters }, callback) => {
      try {
        const producer = await mediasoupManager.createProducer(
          `${streamId}:${transportId}`,
          kind,
          rtpParameters,
        );

        callback({ producerId: producer.id });

        const isHostProducer = await prisma.stream.findFirst({
          where: {
            id: streamId,
            creator: { clerkId: socket.handshake.auth.userId },
          },
        });

        // Notify all clients in the room about the new producer
        socket.to(streamId).emit("new-producer", {
          producerId: producer.id,
          kind,
          socketId: isHostProducer ? "host" : socket.id,
        });
      } catch (error: any) {
        console.error("[Socket] Error producing:", error);
        callback({ error: error.message });
      }
    },
  );

  // WebRTC Signaling - Consume
  socket.on(
    "consume",
    async (
      { streamId, transportId, producerId, rtpCapabilities },
      callback,
    ) => {
      try {
        const consumer = await mediasoupManager.createConsumer(
          `${streamId}:${transportId}`,
          producerId,
          rtpCapabilities,
        );

        if (!consumer) {
          return callback({ error: "Cannot consume" });
        }

        callback({
          consumerId: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
      } catch (error: any) {
        console.error("[Socket] Error consuming:", error);
        callback({ error: error.message });
      }
    },
  );

  // Chat message with AI moderation
  socket.on("chat-message", async ({ streamId, message, userId, username }) => {
    try {
      // 1. Fetch Creator/Stream setup to check Aura settings
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: { creator: true }
      });

      if (!stream) return;
 
      let moderation: any = { action: "allow", confidence: 1.0, reason: "" };

      // 2. AI Moderation (Only if Aura is enabled for this creator)
      if (stream.creator.auraEnabled) {
        moderation = await swaniAI.moderateMessage(message, {
          streamId,
          userId,
          username,
        });
      }

      // Store message in database
      const data = await prisma.chatMessage.create({
        data: {
          streamId: streamId,
          userId: userId,
          message:
            moderation.action === "delete" ? "[Message removed]" : message,
          aiModerated: true,
          aiConfidence: moderation.confidence,
          aiAction: moderation.action,
          isDeleted: moderation.action === "delete",
        },
      });

      // Broadcast message (or moderation notice)
      if (moderation.action === "delete") {
        socket.emit("message-rejected", {
          reason: moderation.reason,
          confidence: moderation.confidence,
        });
      } else {
        io.to(streamId).emit("chat-message", {
          id: data.id,
          userId,
          username,
          message: message,
          aiAction: moderation.action,
          aiConfidence: moderation.confidence,
          aiReason: moderation.reason,
          timestamp: data.createdAt,
        });

        // 3. Automated AI Response (if command triggered)
        if (message.startsWith("!summarize") || message.startsWith("!ask")) {
          const prompt = message.replace(/^!(summarize|ask)\s*/, "");
          const context = { streamId, triggerUser: username, theme: "gold-board" };
          
          const aiResponse = await swaniAI.askAI(
            message.startsWith("!summarize") ? "Summarize the chat history for this stream." : prompt, 
            context
          );

          io.to(streamId).emit("chat-message", {
            id: `ai-${Date.now()}`,
            userId: "swani-ai",
            username: "SWANI AI",
            message: aiResponse,
            timestamp: new Date(),
            aiAction: "allow",
          });

          if (message.startsWith("!summarize")) {
            io.to(streamId).emit("stream-summary", aiResponse);
          }
        }
      }

      // Log flagged messages for review
      if (moderation.action === "flag") {
        console.log(
          `[Moderation] Flagged message in stream ${streamId}: ${message.substring(0, 50)}...`,
        );
      }
    } catch (error: any) {
      console.error("[Socket] Error handling chat message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Guest panel management
  socket.on("join-as-guest", async ({ streamId, userId, gridPosition }) => {
    try {
      const guestId = await streamManager.addGuest(
        streamId,
        userId,
        gridPosition,
      );

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

      console.log(
        `[Socket] Guest ${userId} joined panel at position ${gridPosition} in stream ${streamId}`,
      );
    } catch (error: any) {
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
    } catch (error: any) {
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
      const party = await watchPartyManager.joinParty(
        partyId,
        userId,
        socket.id,
      );

      socket.emit("watch-party-joined", {
        partyId,
        playback: party.playback,
        partyData: {
          videoUrl: party.videoUrl,
          title: party.title,
        },
        participants: Array.from(party.participants.entries()).map(
          (item: any) => ({
            userId: item[0],
            isReady: item[1].isReady,
            status: item[1].status,
          }),
        ),
      });

      socket.to(`party:${partyId}`).emit("participant-joined", {
        userId,
        timestamp: new Date().toISOString(),
      });

      console.log(`[Socket] User ${userId} joined watch party ${partyId}`);
    } catch (error: any) {
      console.error("[Socket] Error joining watch party:", error);
      socket.emit("error", { message: error.message });
    }
  });

  socket.on(
    "watch-party-sync-playback",
    ({ partyId, currentTime, isPlaying }) => {
      watchPartyManager.updatePlayback(partyId, currentTime, isPlaying);
      socket.to(`party:${partyId}`).emit("playback-updated", {
        currentTime,
        isPlaying,
        senderId: socket.id,
      });
    },
  );

  socket.on(
    "watch-party-ready-status",
    async ({ partyId, userId, isReady }) => {
      await watchPartyManager.setReadyStatus(partyId, userId, isReady);
      io.to(`party:${partyId}`).emit("participant-ready-change", {
        userId,
        isReady,
      });
    },
  );

  // AI Assistance in Watch Party
  socket.on(
    "ask-party-ai",
    async ({ partyId, prompt, userId: _userId, username, model }) => {
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
      } catch (error: any) {
        console.error("[Socket] AI error in watch party:", error);
      }
    },
  );

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
  } catch (error: any) {
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
