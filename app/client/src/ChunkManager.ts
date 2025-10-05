/**
 * ChunkManager.ts - Client-side chunk management
 * Handles chunk storage, mesh generation, and rendering
 */

import { ChunkData, ChunkMesh, ChunkKey } from "./types";
import { logger } from "./utils/logger";

interface MeshRequest {
  chunkKey: string;
  chunkData: ChunkData;
  callback: (mesh: ChunkMesh) => void;
}

export class ChunkManager {
  private chunks: Map<string, ChunkData> = new Map();
  private meshes: Map<string, ChunkMesh> = new Map();
  private meshVersions: Map<string, number> = new Map();
  
  private meshWorker: Worker | null = null;
  private pendingMeshRequests: Map<number, MeshRequest> = new Map();
  private nextRequestId: number = 1;
  
  private meshGenerationQueue: MeshRequest[] = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.initMeshWorker();
  }

  /**
   * Initialize mesh generation worker
   */
  private initMeshWorker() {
    try {
      this.meshWorker = new Worker(
        new URL("./workers/chunkMeshWorker.ts", import.meta.url),
        { type: "module" }
      );

      this.meshWorker.onmessage = (e: MessageEvent) => {
        const { type, requestId, mesh, error } = e.data;

        const request = this.pendingMeshRequests.get(requestId);
        if (!request) return;

        this.pendingMeshRequests.delete(requestId);

        if (type === "error") {
          logger.error(`[ChunkManager] Mesh generation error: ${error}`);
          return;
        }

        if (type === "mesh_generated" && mesh) {
          this.meshes.set(request.chunkKey, mesh);
          this.meshVersions.set(request.chunkKey, request.chunkData.version);
          request.callback(mesh);
        }

        // Process next item in queue
        this.processNextMeshRequest();
      };

      logger.info("[ChunkManager] Mesh worker initialized");
    } catch (error) {
      logger.error("[ChunkManager] Failed to create mesh worker:", error);
    }
  }

  /**
   * Process next mesh generation request from queue
   */
  private processNextMeshRequest() {
    if (this.meshGenerationQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    const request = this.meshGenerationQueue.shift();
    if (!request) return;

    this.generateMeshInternal(request);
  }

  /**
   * Generate mesh for a chunk (internal)
   */
  private generateMeshInternal(request: MeshRequest) {
    if (!this.meshWorker) {
      logger.error("[ChunkManager] Mesh worker not available");
      return;
    }

    const requestId = this.nextRequestId++;
    this.pendingMeshRequests.set(requestId, request);

    // Get neighbor chunks
    const { cx, cy, cz } = request.chunkData;
    const neighborChunks: ChunkData[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;

          const neighborKey = ChunkKey.toString(cx + dx, cy + dy, cz + dz);
          const neighborChunk = this.chunks.get(neighborKey);
          
          if (neighborChunk) {
            neighborChunks.push(neighborChunk);
          }
        }
      }
    }

    // Send request to worker
    this.meshWorker.postMessage({
      type: "generate_mesh",
      chunkData: request.chunkData,
      neighborChunks,
      requestId,
    });
  }

  /**
   * Add or update a chunk
   */
  setChunk(chunkData: ChunkData): void {
    const chunkKey = ChunkKey.toString(chunkData.cx, chunkData.cy, chunkData.cz);
    this.chunks.set(chunkKey, chunkData);

    // Check if we need to regenerate mesh
    const existingVersion = this.meshVersions.get(chunkKey);
    if (existingVersion !== chunkData.version) {
      this.invalidateMesh(chunkKey);
    }
  }

  /**
   * Get a chunk
   */
  getChunk(cx: number, cy: number, cz: number): ChunkData | undefined {
    const chunkKey = ChunkKey.toString(cx, cy, cz);
    return this.chunks.get(chunkKey);
  }

  /**
   * Check if chunk exists
   */
  hasChunk(cx: number, cy: number, cz: number): boolean {
    const chunkKey = ChunkKey.toString(cx, cy, cz);
    return this.chunks.has(chunkKey);
  }

  /**
   * Get mesh for a chunk
   */
  getMesh(cx: number, cy: number, cz: number): ChunkMesh | undefined {
    const chunkKey = ChunkKey.toString(cx, cy, cz);
    return this.meshes.get(chunkKey);
  }

  /**
   * Check if mesh exists and is up to date
   */
  hasMesh(cx: number, cy: number, cz: number): boolean {
    const chunkKey = ChunkKey.toString(cx, cy, cz);
    const mesh = this.meshes.get(chunkKey);
    if (!mesh) return false;

    const chunk = this.chunks.get(chunkKey);
    if (!chunk) return false;

    const meshVersion = this.meshVersions.get(chunkKey);
    return meshVersion === chunk.version;
  }

  /**
   * Request mesh generation for a chunk
   */
  requestMesh(cx: number, cy: number, cz: number, callback: (mesh: ChunkMesh) => void): void {
    const chunkKey = ChunkKey.toString(cx, cy, cz);
    const chunkData = this.chunks.get(chunkKey);

    if (!chunkData) {
      logger.warn(`[ChunkManager] Cannot generate mesh for missing chunk: ${chunkKey}`);
      return;
    }

    // Check if we already have an up-to-date mesh
    if (this.hasMesh(cx, cy, cz)) {
      const mesh = this.meshes.get(chunkKey);
      if (mesh) {
        callback(mesh);
        return;
      }
    }

    // Add to queue
    const request: MeshRequest = {
      chunkKey,
      chunkData,
      callback,
    };

    this.meshGenerationQueue.push(request);

    // Start processing queue if not already processing
    if (!this.isProcessingQueue) {
      this.isProcessingQueue = true;
      this.processNextMeshRequest();
    }
  }

  /**
   * Invalidate mesh (force regeneration)
   */
  invalidateMesh(chunkKey: string): void {
    this.meshes.delete(chunkKey);
    this.meshVersions.delete(chunkKey);
  }

  /**
   * Invalidate meshes for chunk and its neighbors
   */
  invalidateChunkAndNeighbors(cx: number, cy: number, cz: number): void {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const neighborKey = ChunkKey.toString(cx + dx, cy + dy, cz + dz);
          this.invalidateMesh(neighborKey);
        }
      }
    }
  }

  /**
   * Remove a chunk
   */
  removeChunk(cx: number, cy: number, cz: number): void {
    const chunkKey = ChunkKey.toString(cx, cy, cz);
    this.chunks.delete(chunkKey);
    this.meshes.delete(chunkKey);
    this.meshVersions.delete(chunkKey);

    // Invalidate neighbor meshes
    this.invalidateChunkAndNeighbors(cx, cy, cz);
  }

  /**
   * Get all loaded chunks
   */
  getAllChunks(): Map<string, ChunkData> {
    return new Map(this.chunks);
  }

  /**
   * Get all generated meshes
   */
  getAllMeshes(): Map<string, ChunkMesh> {
    return new Map(this.meshes);
  }

  /**
   * Clear all chunks and meshes
   */
  clear(): void {
    this.chunks.clear();
    this.meshes.clear();
    this.meshVersions.clear();
    this.meshGenerationQueue = [];
    this.pendingMeshRequests.clear();
    this.isProcessingQueue = false;
  }

  /**
   * Get statistics
   */
  getStats(): {
    chunkCount: number;
    meshCount: number;
    queueLength: number;
    pendingRequests: number;
  } {
    return {
      chunkCount: this.chunks.size,
      meshCount: this.meshes.size,
      queueLength: this.meshGenerationQueue.length,
      pendingRequests: this.pendingMeshRequests.size,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.meshWorker) {
      this.meshWorker.terminate();
      this.meshWorker = null;
    }

    this.clear();
  }
}
