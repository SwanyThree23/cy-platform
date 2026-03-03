import prisma from "./prisma";
import Stripe from "stripe";
import Mux from "@mux/mux-node";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2023-10-16" as any,
});

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID || "placeholder",
  tokenSecret: process.env.MUX_TOKEN_SECRET || "placeholder",
});

/**
 * CY PLATFORM - BACKGROUND WORKER
 * Handles asynchronous tasks, status synchronizations, and cleanup
 */
class VideoWorker {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("🚀 CY Background Worker started...");

    // Run every 60 seconds
    this.interval = setInterval(() => this.runTasks(), 60000);
    this.runTasks(); // Initial run
  }

  private async runTasks() {
    try {
      console.log(`[Worker] Running periodic tasks at ${new Date().toISOString()}`);
      
      await Promise.all([
        this.syncMuxAssetStatuses(),
        this.cleanupStaleStreams(),
        this.processPendingPayments(),
      ]);
      
    } catch (error) {
      console.error("[Worker] Task Run Error:", error);
    }
  }

  /**
   * Syncs VideoPost status with Mux for assets that are still PROCESSING
   */
  private async syncMuxAssetStatuses() {
    const processingPosts = await prisma.videoPost.findMany({
      where: { 
        status: "PROCESSING",
        muxAssetId: { not: null }
      }
    });

    for (const post of processingPosts) {
      try {
        const asset = await mux.video.assets.retrieve(post.muxAssetId!);
        
        if (asset.status === "ready") {
          const playbackId = asset.playback_ids?.[0]?.id;
          await prisma.videoPost.update({
            where: { id: post.id },
            data: {
              status: "READY",
              videoUrl: `https://stream.mux.com/${playbackId}.m3u8`,
              thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
              muxPlaybackId: playbackId
            }
          });
          console.log(`[Worker] Synced Mux post ${post.id} to READY`);
        }
      } catch (err) {
        console.error(`[Worker] Mux sync failed for asset ${post.muxAssetId}:`, err);
      }
    }
  }

  /**
   * Ends streams that haven't been updated in over 1 hour but are still marked LIVE
   */
  private async cleanupStaleStreams() {
    const hourAgo = new Date(Date.now() - 3600 * 1000);
    
    const staleStreams = await prisma.stream.updateMany({
      where: {
        status: "LIVE",
        updatedAt: { lt: hourAgo }
      },
      data: {
        status: "ENDED",
        endedAt: new Date()
      }
    });

    if (staleStreams.count > 0) {
      console.log(`[Worker] Closed ${staleStreams.count} stale streams`);
    }
  }

  /**
   * Syncs pending payments with Stripe if webhook was missed
   */
  private async processPendingPayments() {
    // Logic to poll Stripe sessions if needed
    // Typically redundant if webhooks work, but good for "Robustness"
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
    console.log("🛑 CY Background Worker stopped.");
  }
}

const worker = new VideoWorker();
worker.start();

// Handle process signals
process.on("SIGINT", () => worker.stop());
process.on("SIGTERM", () => worker.stop());
