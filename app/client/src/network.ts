/**
 * network.ts - Network manager for the game
 * Handles world assignment, cubic chunks, and binary protocol
 */

import { logger } from "./utils/logger";
import { loadBlockpacksFromServer, blockMapping } from "./data/BlockRegistry";
import { LoadingStep } from "./components/ui";

const CHUNK_SIZE = 16;

export interface Block {
  x: number;
  y: number;
  z: number;
  type: number;
}

export interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  version: number;
  blocks: Block[];
  blocksArray: Uint16Array;
}

export interface GameState {
  playerId: string | null;
  players: Map<string, PlayerData>;
  chunks: Map<string, ChunkData>;
  connected: boolean;
  worldAssigned: boolean;
  spawnPoint: { x: number; y: number; z: number } | null;
  generatorType: string | null;
}

interface PlayerData {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
}

export class NetworkManager {
  private ws: WebSocket | null = null;
  private chunkDecoderWorker: Worker | null = null;
  private pendingDecodes: Map<number, (data: any) => void> = new Map();
  private nextRequestId: number = 1;
  private pendingChunkRequests: Set<string> = new Set();
  
  private gameState: GameState;
  private onStateUpdate: (state: GameState) => void;
  private onConnectionChange: (connected: boolean) => void;
  private onWorldAssigned?: (
    spawnPoint: { x: number; y: number; z: number },
    serverSettings?: { maxRenderDistance?: number; forceRenderDistance?: boolean }
  ) => void;
  private onLoadingStep?: (name: string, status: LoadingStep['status'], detail?: string) => void;
  private onBlockpacksReady?: () => void;
  
  private authenticatedUser: any = null;

  constructor(
    onStateUpdate: (state: GameState) => void,
    onConnectionChange: (connected: boolean) => void,
    user?: any,
    onLoadingStep?: (name: string, status: LoadingStep['status'], detail?: string) => void,
    onBlockpacksReady?: () => void
  ) {
    this.gameState = {
      playerId: null,
      players: new Map(),
      chunks: new Map(),
      connected: false,
      worldAssigned: false,
      spawnPoint: null,
      generatorType: null,
    };
    
    this.onStateUpdate = onStateUpdate;
    this.onConnectionChange = onConnectionChange;
    this.authenticatedUser = user || null;
    this.onLoadingStep = onLoadingStep;
    this.onBlockpacksReady = onBlockpacksReady;
  }

  setAuthenticatedUser(user: any) {
    this.authenticatedUser = user;
  }

  /**
   * Initialize chunk decoder worker
   */
  private initChunkDecoder() {
    if (this.chunkDecoderWorker) return;

    try {
      this.chunkDecoderWorker = new Worker(
        new URL("./workers/chunkDecoderWorker.ts", import.meta.url),
        { type: "module" }
      );

      this.chunkDecoderWorker.onmessage = (e: MessageEvent) => {
        const { type, requestId, data, error } = e.data;

        const callback = this.pendingDecodes.get(requestId);
        if (!callback) return;

        this.pendingDecodes.delete(requestId);

        if (type === "error") {
          logger.error(`[Network] Chunk decode error: ${error}`);
          return;
        }

        callback(data);
      };

      logger.info("[Network] Chunk decoder worker initialized");
    } catch (error) {
      logger.error("[Network] Failed to create chunk decoder worker:", error);
    }
  }

  /**
   * Decode chunk data using worker
   */
  private async decodeChunk(buffer: ArrayBuffer): Promise<ChunkData> {
    return new Promise((resolve, reject) => {
      if (!this.chunkDecoderWorker) {
        this.initChunkDecoder();
      }

      if (!this.chunkDecoderWorker) {
        reject(new Error("Chunk decoder worker not available"));
        return;
      }

      const requestId = this.nextRequestId++;
      
      this.pendingDecodes.set(requestId, (data) => {
        resolve(data);
      });

      this.chunkDecoderWorker.postMessage({
        type: "decode_chunk",
        buffer,
        requestId,
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingDecodes.has(requestId)) {
          this.pendingDecodes.delete(requestId);
          reject(new Error("Chunk decode timeout"));
        }
      }, 5000);
    });
  }

  /**
   * Decode block update using worker
   */
  private async decodeBlockUpdate(buffer: ArrayBuffer): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.chunkDecoderWorker) {
        this.initChunkDecoder();
      }

      if (!this.chunkDecoderWorker) {
        reject(new Error("Chunk decoder worker not available"));
        return;
      }

      const requestId = this.nextRequestId++;
      
      this.pendingDecodes.set(requestId, (data) => {
        resolve(data);
      });

      this.chunkDecoderWorker.postMessage({
        type: "decode_update",
        buffer,
        requestId,
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingDecodes.has(requestId)) {
          this.pendingDecodes.delete(requestId);
          reject(new Error("Block update decode timeout"));
        }
      }, 5000);
    });
  }

  /**
   * Connect to server
   */
  connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.onLoadingStep?.('Connecting to server', 'loading', serverUrl);
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
          logger.info("[Network] Connected to server");
          this.gameState.connected = true;
          this.onConnectionChange(true);
          this.onLoadingStep?.('Connecting to server', 'completed', 'Connection established');

          // Send authentication
          if (this.authenticatedUser) {
            this.onLoadingStep?.('Authenticating', 'loading', `Logging in as ${this.authenticatedUser.username}...`);
            const token = localStorage.getItem("vaste_token");
            this.sendMessage({
              type: "auth_info",
              username: this.authenticatedUser.username,
              uuid: this.authenticatedUser.uuid,
              token: token,
            });
          }

          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            // Handle binary messages (chunks)
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
              const buffer = event.data instanceof Blob 
                ? await event.data.arrayBuffer() 
                : event.data;
              
              logger.debug(`[Network] Received binary message: ${buffer.byteLength} bytes`);
              await this.handleBinaryMessage(buffer);
              return;
            }

            // Handle JSON messages
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            logger.error("[Network] Error handling message:", error);
          }
        };

        this.ws.onclose = () => {
          logger.info("[Network] Disconnected from server");
          this.gameState.connected = false;
          this.gameState.worldAssigned = false;
          this.onConnectionChange(false);
        };

        this.ws.onerror = (error) => {
          logger.error("[Network] WebSocket error:", error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle binary messages (chunks and block updates)
   */
  private async handleBinaryMessage(buffer: ArrayBuffer) {
    try {
      const view = new DataView(buffer);
      const messageType = view.getUint8(0);

      logger.debug(`[Network] Binary message type: ${messageType}`);

      if (messageType === 2) {
        // CHUNK_DATA
        logger.debug(`[Network] Decoding chunk data...`);
        const chunkData = await this.decodeChunk(buffer);
        this.handleChunkData(chunkData);
      } else if (messageType === 3) {
        // CHUNK_UPDATE
        const update = await this.decodeBlockUpdate(buffer);
        this.handleBlockUpdate(update);
      } else {
        logger.warn(`[Network] Unknown binary message type: ${messageType}`);
      }
    } catch (error) {
      logger.error("[Network] Error handling binary message:", error);
      console.error(error);
    }
  }

  /**
   * Handle chunk data
   */
  private handleChunkData(chunkData: ChunkData) {
    const chunkKey = `${chunkData.cx},${chunkData.cy},${chunkData.cz}`;
    
    // Ignore if not pending (was cancelled)
    if (!this.pendingChunkRequests.has(chunkKey)) {
      logger.debug(`[Network] Ignoring cancelled chunk ${chunkKey}`);
      return;
    }
    
    // Remove from pending requests
    this.pendingChunkRequests.delete(chunkKey);
    
    // Store chunk
    this.gameState.chunks.set(chunkKey, chunkData);
    
    logger.info(`[Network] Stored chunk (${chunkData.cx}, ${chunkData.cy}, ${chunkData.cz}) - Total chunks: ${this.gameState.chunks.size}`);
    
    // Trigger state update
    this.onStateUpdate(this.gameState);
  }

  /**
   * Handle block update
   */
  private handleBlockUpdate(update: { x: number; y: number; z: number; blockType: number }) {
    const cx = Math.floor(update.x / CHUNK_SIZE);
    const cy = Math.floor(update.y / CHUNK_SIZE);
    const cz = Math.floor(update.z / CHUNK_SIZE);
    const chunkKey = `${cx},${cy},${cz}`;

    const chunk = this.gameState.chunks.get(chunkKey);
    if (!chunk) {
      logger.warn(`[Network] Received block update for unloaded chunk: ${chunkKey}`);
      return;
    }

    // Update chunk version
    chunk.version++;

    // Update blocks array if available
    if (chunk.blocksArray) {
      const localX = ((update.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((update.y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localZ = ((update.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const index = (localY * CHUNK_SIZE * CHUNK_SIZE) + (localZ * CHUNK_SIZE) + localX;
      chunk.blocksArray[index] = update.blockType;
    }

    // Update sparse block list
    if (update.blockType === 0) {
      // Remove block
      chunk.blocks = chunk.blocks.filter(
        (b) => b.x !== update.x || b.y !== update.y || b.z !== update.z
      );
    } else {
      // Add or update block
      const existingIndex = chunk.blocks.findIndex(
        (b) => b.x === update.x && b.y === update.y && b.z === update.z
      );
      
      if (existingIndex >= 0) {
        chunk.blocks[existingIndex].type = update.blockType;
      } else {
        chunk.blocks.push({
          x: update.x,
          y: update.y,
          z: update.z,
          type: update.blockType,
        });
      }
    }

    logger.debug(`[Network] Block update at (${update.x}, ${update.y}, ${update.z}): type=${update.blockType}`);
    
    // Trigger state update
    this.onStateUpdate(this.gameState);
  }

  /**
   * Handle JSON messages
   */
  private handleMessage(message: any) {
    switch (message.type) {
      case "blockpacks_data":
        this.handleBlockpacksData(message);
        break;

      case "block_mapping":
        this.handleBlockMapping(message);
        break;

      case "world_assign":
        this.handleWorldAssign(message);
        break;

      case "player_joined":
        this.handlePlayerJoined(message);
        break;

      case "player_left":
        this.handlePlayerLeft(message);
        break;

      case "player_move":
        this.handlePlayerMove(message);
        break;

      case "error":
        this.handleError(message);
        break;

      default:
        logger.warn(`[Network] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle blockpacks data from server
   */
  private async handleBlockpacksData(message: any) {
    logger.info(`[Network] Received ${message.blockpacks.length} blockpacks from server`);
    this.onLoadingStep?.('Downloading blockpacks', 'loading', `Receiving ${message.blockpacks.length} blockpack(s)...`);
    
    try {
      // Extract server host from WebSocket URL and use provided HTTP port
      const wsUrl = this.ws?.url || '';
      const url = new URL(wsUrl);
      const httpPort = message.httpPort || 25566; // Use port from server, fallback to 25566
      const serverUrl = `http://${url.hostname}:${httpPort}`;
      
      logger.info(`[Network] Using HTTP port ${httpPort} for blockpack assets`);
      this.onLoadingStep?.('Downloading blockpacks', 'loading', `Loading definitions from ${url.hostname}:${httpPort}...`);
      
      // Load blockpacks from server data
      await loadBlockpacksFromServer(message.blockpacks, serverUrl);
      
      this.onLoadingStep?.('Downloading blockpacks', 'completed', `${message.blockpacks.length} blockpack(s) loaded`);
      this.onLoadingStep?.('Initializing block registry', 'loading', 'Mapping block IDs...');
      
      // Initialize block mapping with loaded blocks
      blockMapping.initializeFromRegistry();
      
      this.onLoadingStep?.('Initializing block registry', 'completed', `${blockMapping.getAllStringIds().length} blocks registered`);
      
      logger.info('[Network] Blockpacks loaded and registry initialized');
      
      // Notify that blockpacks are ready
      if (this.onBlockpacksReady) {
        this.onBlockpacksReady();
      }
      
      // Notify that we're ready for world assignment
      this.onLoadingStep?.('Confirming readiness', 'loading', 'Sending confirmation to server...');
      this.sendMessage({ type: "blockpacks_loaded" });
      this.onLoadingStep?.('Confirming readiness', 'completed', 'Ready for world data');
    } catch (error) {
      logger.error('[Network] Error loading blockpacks:', error);
      this.onLoadingStep?.('Downloading blockpacks', 'error', 'Failed to load blockpacks');
    }
  }

  /**
   * Handle block mapping table from server
   */
  private handleBlockMapping(message: any) {
    logger.info(`[Network] Received block mapping table: ${message.mappings.length} blocks`);
    
    // Import blockMapping here to avoid circular dependency
    import('./data/BlockRegistry').then(({ blockMapping }) => {
      blockMapping.loadMappingTable(message.mappings);
      logger.info('[Network] Block mapping synchronized with server');
    });
  }

  /**
   * Handle world assignment
   */
  private handleWorldAssign(message: any) {
    logger.info(`[Network] World assigned: ${message.generatorType}`);
    logger.info(`[Network] Spawn point: (${message.spawnPoint.x}, ${message.spawnPoint.y}, ${message.spawnPoint.z})`);
    
    this.onLoadingStep?.('Receiving world data', 'loading', `Generator: ${message.generatorType}`);
    
    if (message.maxRenderDistance !== undefined) {
      logger.info(`[Network] Server max render distance: ${message.maxRenderDistance}`);
    }
    if (message.forceRenderDistance === true) {
      logger.info(`[Network] Server forcing render distance to maximum`);
    }

    this.gameState.worldAssigned = true;
    this.gameState.spawnPoint = message.spawnPoint;
    this.gameState.generatorType = message.generatorType;

    this.onLoadingStep?.('Receiving world data', 'completed', `Spawn at (${Math.floor(message.spawnPoint.x)}, ${Math.floor(message.spawnPoint.y)}, ${Math.floor(message.spawnPoint.z)})`);
    this.onLoadingStep?.('Loading terrain', 'loading', 'Requesting initial chunks...');

    if (this.onWorldAssigned) {
      this.onWorldAssigned(message.spawnPoint, {
        maxRenderDistance: message.maxRenderDistance,
        forceRenderDistance: message.forceRenderDistance
      });
    }

    this.onStateUpdate(this.gameState);
  }

  /**
   * Handle player joined
   */
  private handlePlayerJoined(message: any) {
    const player: PlayerData = {
      id: message.id,
      username: message.username,
      x: message.x,
      y: message.y,
      z: message.z,
    };

    this.gameState.players.set(message.id, player);
    logger.info(`[Network] Player joined: ${message.username}`);
    
    this.onStateUpdate(this.gameState);
  }

  /**
   * Handle player left
   */
  private handlePlayerLeft(message: any) {
    const player = this.gameState.players.get(message.id);
    if (player) {
      logger.info(`[Network] Player left: ${player.username}`);
      this.gameState.players.delete(message.id);
      this.onStateUpdate(this.gameState);
    }
  }

  /**
   * Handle player move
   */
  private handlePlayerMove(message: any) {
    const player = this.gameState.players.get(message.id);
    if (player) {
      player.x = message.x;
      player.y = message.y;
      player.z = message.z;
      this.onStateUpdate(this.gameState);
    }
  }

  /**
   * Handle error
   */
  private handleError(message: any) {
    logger.error(`[Network] Server error: ${message.message} (code: ${message.code})`);
    
    if (message.code === "NO_WORLD") {
      // Server has no world - stay in loading state
      logger.warn("[Network] Server has no active world. Waiting for world to be created...");
    }
  }

  /**
   * Send message to server
   */
  sendMessage(message: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn("[Network] Cannot send message: not connected");
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error("[Network] Error sending message:", error);
    }
  }

  /**
   * Send player movement
   */
  sendPlayerMove(x: number, y: number, z: number) {
    this.sendMessage({
      type: "player_move",
      x,
      y,
      z,
    });
  }

  /**
   * Send block place
   */
  sendBlockPlace(x: number, y: number, z: number, blockType: number) {
    this.sendMessage({
      type: "block_place",
      x,
      y,
      z,
      blockType,
    });
  }

  /**
   * Send block break
   */
  sendBlockBreak(x: number, y: number, z: number) {
    this.sendMessage({
      type: "block_break",
      x,
      y,
      z,
    });
  }

  /**
   * Request chunk from server
   */
  requestChunk(cx: number, cy: number, cz: number) {
    const chunkKey = `${cx},${cy},${cz}`;
    this.pendingChunkRequests.add(chunkKey);
    
    logger.debug(`[Network] Requesting chunk (${cx}, ${cy}, ${cz})`);
    this.sendMessage({
      type: "chunk_request",
      cx,
      cy,
      cz,
    });
  }

  /**
   * Clear all chunks from local cache
   */
  clearChunks() {
    logger.info('[Network] Clearing all chunks');
    this.gameState.chunks.clear();
    this.onStateUpdate(this.gameState);
  }

  /**
   * Cancel all pending chunk requests
   */
  cancelPendingChunkRequests() {
    const count = this.pendingChunkRequests.size;
    logger.info(`[Network] Cancelling ${count} pending chunk requests`);
    this.pendingChunkRequests.clear();
  }


  /**
   * Set world assigned callback
   */
  setOnWorldAssigned(callback: (
    spawnPoint: { x: number; y: number; z: number },
    serverSettings?: { maxRenderDistance?: number; forceRenderDistance?: boolean }
  ) => void) {
    this.onWorldAssigned = callback;
  }

  /**
   * Get game state
   */
  getState(): GameState {
    return this.gameState;
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.chunkDecoderWorker) {
      this.chunkDecoderWorker.terminate();
      this.chunkDecoderWorker = null;
    }

    this.gameState.connected = false;
    this.gameState.worldAssigned = false;
    this.onConnectionChange(false);
  }
}
