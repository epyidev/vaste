/**
 * server.js - Vaste Game Server
 * Complete server with cubic chunks, region-based storage, and mod integration
 */

const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { VasteModSystem } = require("./VasteModSystem");
const { ChunkProtocol } = require("./world/ChunkProtocol");
const { CHUNK_SIZE } = require("./world");
const { BlockpackManager } = require("./BlockpackManager");
const { log, error } = require("./Logger");

// Load server configuration first
const CONFIG_FILE = path.join(__dirname, "..", "server-config.json");  // Un niveau au-dessus
let SERVER_CONFIG = {};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      SERVER_CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    } else {
      log("server-config.json not found! Please create it with your license key.", "ERROR");
      log("Example configuration:", "INFO");
      console.log(
        JSON.stringify(
          {
            license_key: "vaste_your_license_key_here",
            max_players: 20,
            wsPort: 25565,
            httpPort: 25566
          },
          null,
          2
        )
      );
      process.exit(1);
    }
  } catch (error) {
    log(`Error loading configuration: ${error.message}`, "ERROR");
    process.exit(1);
  }
}

// Load config before using ports
loadConfig();

const PORT = SERVER_CONFIG.wsPort || process.env.PORT || 25565;
const HTTP_PORT = SERVER_CONFIG.httpPort || process.env.HTTP_PORT || 25566;
const DEFAULT_RENDER_DISTANCE = 4; // chunks

// Initialize Blockpack Manager
const blockpackManager = new BlockpackManager(path.join(__dirname, "blockpacks"));

// ASCII Art for VASTE
function showVasteAscii() {
  console.log(`
 ██╗   ██╗ █████╗ ███████╗████████╗███████╗
 ██║   ██║██╔══██╗██╔════╝╚══██╔══╝██╔════╝
 ██║   ██║███████║███████╗   ██║   █████╗  
 ╚██╗ ██╔╝██╔══██║╚════██║   ██║   ██╔══╝  
  ╚████╔╝ ██║  ██║███████║   ██║   ███████╗
   ╚═══╝  ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝
    `);
}

// Backend configuration
const BACKEND_HOST = "localhost";
const BACKEND_PORT = 8080;
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

// Validate license with backend
async function validateLicense() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      license_key: SERVER_CONFIG.license_key,
    });

    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: "/api/game-servers/validate-license",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(responseData);
          if (res.statusCode === 200 && result.valid) {
            resolve(result);
          } else {
            reject(new Error(result.error || "License validation failed"));
          }
        } catch (error) {
          reject(new Error("Invalid response from backend"));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Cannot connect to backend: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

// Send heartbeat to backend
async function sendHeartbeat(playerCount) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      license_key: SERVER_CONFIG.license_key,
      current_players: playerCount,
    });

    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: "/api/game-servers/heartbeat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          resolve(); // Don't fail on heartbeat errors
        }
      });
    });

    req.on("error", () => {
      resolve(); // Don't fail on heartbeat errors
    });

    req.write(data);
    req.end();
  });
}

// Validate user token with backend
async function validateUserToken(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: "/api/auth/verify",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(responseData);
          if (res.statusCode === 200 && result.success && result.data && result.data.user) {
            resolve(result.data.user);
          } else {
            reject(new Error(result.message || "Token validation failed"));
          }
        } catch (error) {
          reject(new Error("Invalid response from backend"));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Cannot validate token with backend: ${error.message}`));
    });

    req.end();
  });
}

// Game server class
class GameServer {
  constructor(options = {}) {
    this.players = new Map();
    this.options = options || {};
    this.log = (msg, level) => log(msg, level);

    // Initialize modding system
    this.modSystem = new VasteModSystem(this);

    // Render distance configuration
    this.renderDistanceChunks = DEFAULT_RENDER_DISTANCE;

    // WebSocket server
    this.wss = new WebSocket.Server({ port: PORT });
    this.wss.on("error", (err) => log(`WebSocket server error: ${err.message}`, "ERROR"));

    // HTTP server for blockpack assets (textures)
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });
    this.httpServer.listen(HTTP_PORT);

    log(`Vaste server started on port ${PORT} (WebSocket) and ${HTTP_PORT} (HTTP)`);
    this.initializeServer();
  }

  handleHttpRequest(req, res) {
    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // CORS headers for client access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle blockpack texture requests: /blockpacks/{blockName}/textures/{filename}
    const match = url.pathname.match(/^\/blockpacks\/([^\/]+)\/textures\/(.+)$/);
    
    if (match) {
      const [, blockName, texturePath] = match;
      
      blockpackManager.getTexture(blockName, texturePath)
        .then(textureData => {
          res.setHeader('Content-Type', 'image/png');
          res.writeHead(200);
          res.end(textureData);
        })
        .catch(error => {
          log(`Texture request failed: ${error.message}`, "WARN");
          res.writeHead(404);
          res.end('Texture not found');
        });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  async initializeServer() {
    try {
      await blockpackManager.initialize();

      log("Loading mods...");
      await this.modSystem.loadMods();

      const loadedMods = this.modSystem.getLoadedMods();
      if (loadedMods.length > 0) {
        log(`Loaded ${loadedMods.length} mods:`);
        loadedMods.forEach((mod) => {
          log(`  - ${mod.name} v${mod.version || 'unknown'} by ${mod.author || 'unknown'}`);
        });
      } else {
        log("No mods loaded");
      }

      // Check if any mod created a world
      const worldState = this.modSystem.getWorldState();

      this.setupWebSocketServer();
      log("Server initialization complete");
    } catch (error) {
      log(`Error initializing server: ${error.message}`, "ERROR");
      this.setupWebSocketServer(); // Continue without mods
    }
  }

  setupWebSocketServer() {
    this.wss.on("connection", (ws) => {
      let tempConnectionId = uuidv4();
      let authenticatedUser = null;
      let authTimeout = null;

      log(`New connection established, awaiting authentication... (temp ID: ${tempConnectionId.substring(0, 8)})`);

      // Set authentication timeout (30 seconds)
      authTimeout = setTimeout(() => {
        if (!authenticatedUser) {
          log(`Authentication timeout for connection ${tempConnectionId.substring(0, 8)}`, "WARN");
          ws.close(1008, "Authentication timeout");
        }
      }, 30000);

      // Handle messages
      ws.on("message", async (data) => {
        try {
          let message = null;

          // Try to parse as JSON
          try {
            message = JSON.parse(data);
          } catch (err) {
            // If not JSON, might be binary block update
            if (data instanceof Buffer) {
              // Handle binary messages from client (block updates)
              if (!authenticatedUser) {
                log("Received binary message before authentication", "WARN");
                return;
              }
              this.handleBinaryMessage(authenticatedUser.id, data);
              return;
            }
            log(`Invalid message format from ${tempConnectionId}`, "WARN");
            return;
          }

          // Handle authentication
          if (message.type === "auth_info") {
            try {
              authenticatedUser = await this.handleAuthentication(ws, message, tempConnectionId, authTimeout);
              // Don't initialize player yet - wait for blockpacks_loaded confirmation
            } catch (error) {
              log(`Authentication failed: ${error.message}`, "ERROR");
              ws.send(JSON.stringify({ type: "error", message: "Authentication failed" }));
              ws.close(1008, "Authentication failed");
            }
            return;
          }

          // Handle blockpacks loaded confirmation
          if (message.type === "blockpacks_loaded") {
            if (!authenticatedUser) {
              log("Received blockpacks_loaded before authentication", "WARN");
              return;
            }
            
            log(`Client ${authenticatedUser.username} loaded blockpacks, initializing player...`);
            try {
              await this.initializeAuthenticatedPlayer(ws, authenticatedUser);
            } catch (error) {
              log(`Player initialization failed: ${error.message}`, "ERROR");
              ws.send(JSON.stringify({ type: "error", message: "Initialization failed" }));
            }
            return;
          }

          // All other messages require authentication
          if (!authenticatedUser) {
            log(`Received ${message.type} before authentication`, "WARN");
            return;
          }

          // Handle authenticated messages
          this.handlePlayerMessage(authenticatedUser.id, message);
        } catch (error) {
          log(`Error handling message: ${error.message}`, "ERROR");
        }
      });

      ws.on("close", () => {
        if (authTimeout) clearTimeout(authTimeout);

        if (authenticatedUser) {
          this.handlePlayerDisconnect(authenticatedUser.id);
        } else {
          log(`Unauthenticated connection closed (temp ID: ${tempConnectionId.substring(0, 8)})`);
        }
      });

      ws.on("error", (error) => {
        log(`WebSocket error: ${error.message}`, "ERROR");
      });
    });
  }

  async handleAuthentication(ws, message, tempConnectionId, authTimeout) {
    try {
      const { token } = message;

      if (!token) {
        throw new Error("Authentication token is required");
      }

      // Validate token with backend
      const user = await validateUserToken(token);

      if (!user || !user.id || !user.username) {
        throw new Error("Invalid user data received from backend");
      }

      log(`User authenticated: ${user.username} (ID: ${user.id})`);

      // Clear auth timeout
      if (authTimeout) clearTimeout(authTimeout);

      // Send blockpacks to client immediately after authentication
      log(`Sending blockpacks to ${user.username}...`);
      const blockpacksList = blockpackManager.getBlockpacksList();
      const blockDefinitions = [];

      for (const blockName of blockpacksList) {
        try {
          const blockDef = await blockpackManager.getBlockJson(blockName);
          blockDefinitions.push(blockDef);
        } catch (error) {
          log(`Error getting blockpack ${blockName}: ${error.message}`, "ERROR");
        }
      }

      // Send blockpacks data to client
      ws.send(JSON.stringify({
        type: "blockpacks_data",
        blockpacks: blockDefinitions,
        httpPort: HTTP_PORT  // Send HTTP port for texture loading
      }));

      log(`Sent ${blockDefinitions.length} blockpacks to ${user.username}`);

      return user;
    } catch (error) {
      throw error;
    }
  }

  async initializeAuthenticatedPlayer(ws, user) {
    // Check if active world exists
    const worldState = this.modSystem.getWorldState();
    
    if (!worldState || !worldState.world) {
      // No world available - send error and keep player in loading state
      log(`Player ${user.username} cannot spawn: no active world available`, "WARN");
      ws.send(JSON.stringify({
        type: "error",
        message: "No world available. Server is not configured properly.",
        code: "NO_WORLD"
      }));
      // Keep connection open but don't initialize player
      return;
    }

    const world = worldState.world;
    const spawnPoint = worldState.spawnPoint;

    // Create player object
    const player = {
      id: user.id,
      username: user.username,
      uuid: user.uuid,
      x: spawnPoint.x,
      y: spawnPoint.y,
      z: spawnPoint.z,
      ws: ws,
      world: world, // Reference to assigned world
      loadedChunks: new Set(), // Track loaded chunks
      chunkUpdateQueue: [], // Queue for chunk updates
    };

    this.players.set(user.id, player);
    log(`Player ${user.username} (ID: ${user.id}) connected. Total players: ${this.players.size}`);

    // Trigger mod system player join event
    this.modSystem.onPlayerJoin(player);

    // Get player entity (mods may have modified it)
    const playerEntity = this.modSystem.entityManager.getPlayerEntity(user.id);
    
    log(`Player entity after mod join: ${playerEntity ? 'found' : 'not found'}`, "DEBUG");
    if (playerEntity) {
      log(`Player entity world: ${playerEntity.world ? 'assigned' : 'not assigned'}`, "DEBUG");
    }
    
    if (playerEntity && playerEntity.world) {
      // Mod assigned player to a world
      player.world = playerEntity.world;
      if (playerEntity.position) {
        player.x = playerEntity.position.x;
        player.y = playerEntity.position.y;
        player.z = playerEntity.position.z;
      }
      log(`Player ${user.username} assigned to world at (${player.x}, ${player.y}, ${player.z})`, "INFO");
    } else {
      log(`WARNING: Player ${user.username} has no world assigned by mods!`, "WARN");
    }

    // Send block mapping table to client (MUST be sent before world data!)
    const { blockMapping } = require('./BlockRegistry');
    const mappingTable = blockMapping.exportMappingTable();
    ws.send(JSON.stringify({
      type: "block_mapping",
      mappings: mappingTable
    }));
    log(`Sent block mapping table to ${user.username}: ${mappingTable.length} blocks`);

    // Send world assignment message
    const maxRenderDistance = SERVER_CONFIG.maxRenderDistance || 12; // Default 12 if not configured
    const forceRenderDistance = SERVER_CONFIG.forceRenderDistance === true;
    
    const worldAssignMsg = ChunkProtocol.createWorldAssignMessage({
      worldId: 'main',
      spawnPoint: { x: player.x, y: player.y, z: player.z },
      generatorType: player.world.generatorType,
      maxRenderDistance: maxRenderDistance,
      forceRenderDistance: forceRenderDistance
    });
    
    ws.send(worldAssignMsg);
    log(`Sent world assignment to ${user.username}: spawn at (${player.x}, ${player.y}, ${player.z}), max render distance: ${maxRenderDistance}${forceRenderDistance ? ', forced to max' : ''}`);


    // Send nearby chunks
    await this.sendNearbyChunks(user.id);

    // Send existing players to new player
    this.players.forEach((existingPlayer, id) => {
      if (id !== user.id) {
        ws.send(JSON.stringify({
          type: "player_joined",
          id: id,
          username: existingPlayer.username,
          x: existingPlayer.x,
          y: existingPlayer.y,
          z: existingPlayer.z,
        }));
      }
    });

    // Notify other players about new player
    this.broadcastToOthers(user.id, {
      type: "player_joined",
      id: user.id,
      username: player.username,
      x: player.x,
      y: player.y,
      z: player.z,
    });
  }

  async sendNearbyChunks(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.world) return;

    const world = player.world;
    const renderDistance = this.renderDistanceChunks;

    // Calculate player chunk position
    const playerChunkX = Math.floor(player.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(player.y / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.z / CHUNK_SIZE);

    log(`Sending chunks to ${player.username} around chunk (${playerChunkX}, ${playerChunkY}, ${playerChunkZ})`);

    let sentCount = 0;

    // Send chunks in spiral pattern (closest first)
    for (let distance = 0; distance <= renderDistance; distance++) {
      for (let dx = -distance; dx <= distance; dx++) {
        for (let dy = -distance; dy <= distance; dy++) {
          for (let dz = -distance; dz <= distance; dz++) {
            // Skip if not on the current distance shell
            if (Math.abs(dx) !== distance && Math.abs(dy) !== distance && Math.abs(dz) !== distance) {
              continue;
            }

            const cx = playerChunkX + dx;
            const cy = playerChunkY + dy;
            const cz = playerChunkZ + dz;

            const chunkKey = `${cx},${cy},${cz}`;
            
            // Skip if already sent
            if (player.loadedChunks.has(chunkKey)) {
              continue;
            }

            try {
              // Get or generate chunk
              const chunk = world.getOrGenerateChunk(cx, cy, cz);
              
              // Skip empty chunks
              if (chunk.isEmpty()) {
                player.loadedChunks.add(chunkKey);
                continue;
              }

              // Serialize and send chunk
              const buffer = ChunkProtocol.serializeChunk(chunk);
              player.ws.send(buffer);
              
              player.loadedChunks.add(chunkKey);
              sentCount++;
            } catch (error) {
              log(`Error sending chunk (${cx}, ${cy}, ${cz}) to ${player.username}: ${error.message}`, "ERROR");
            }
          }
        }
      }
    }

    log(`Sent ${sentCount} chunks to ${player.username}`);
  }

  handlePlayerMessage(playerId, message) {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (message.type) {
      case "player_move":
        this.handlePlayerMove(playerId, message);
        break;

      case "block_place":
      case "block_break":
        this.handleBlockUpdate(playerId, message);
        break;

      case "chunk_request":
        this.handleChunkRequest(playerId, message);
        break;

      default:
        log(`Unknown message type from ${player.username}: ${message.type}`, "WARN");
    }
  }

  handlePlayerMove(playerId, message) {
    const player = this.players.get(playerId);
    if (!player) return;

    const { x, y, z } = message;

    // Update player position
    player.x = x;
    player.y = y;
    player.z = z;

    // Update entity position in mod system
    this.modSystem.onPlayerMove(player, { x, y, z });

    // Broadcast to other players
    this.broadcastToOthers(playerId, {
      type: "player_move",
      id: playerId,
      x, y, z
    });

    // Check if player moved to a new chunk region
    const currentChunkX = Math.floor(x / CHUNK_SIZE);
    const currentChunkY = Math.floor(y / CHUNK_SIZE);
    const currentChunkZ = Math.floor(z / CHUNK_SIZE);

    // Send new chunks if needed (basic implementation)
    // TODO: More sophisticated chunk streaming
  }

  handleBlockUpdate(playerId, message) {
    const player = this.players.get(playerId);
    if (!player || !player.world) return;

    const { x, y, z, type } = message;
    const blockType = message.type === "block_break" ? 0 : (message.blockType || 1);

    // Update world
    player.world.setBlock(x, y, z, blockType);

    log(`Player ${player.username} ${message.type === "block_break" ? "broke" : "placed"} block at (${x}, ${y}, ${z})`);

    // Create block update message
    const updateBuffer = ChunkProtocol.serializeBlockUpdate(x, y, z, blockType);

    // Broadcast to all players
    this.broadcast(updateBuffer);
  }

  handleBinaryMessage(playerId, buffer) {
    // Handle binary messages from client (e.g., block updates)
    try {
      if (ChunkProtocol.isBinaryChunkMessage(buffer)) {
        const update = ChunkProtocol.deserializeBlockUpdate(buffer);
        this.handleBlockUpdate(playerId, {
          type: update.blockType === 0 ? "block_break" : "block_place",
          x: update.x,
          y: update.y,
          z: update.z,
          blockType: update.blockType
        });
      }
    } catch (error) {
      log(`Error handling binary message: ${error.message}`, "ERROR");
    }
  }

  handleChunkRequest(playerId, message) {
    const player = this.players.get(playerId);
    if (!player) {
      log(`Chunk request from unknown player ${playerId}`, "WARN");
      return;
    }
    
    if (!player.world) {
      log(`Chunk request from ${player.username} but no world assigned!`, "WARN");
      return;
    }

    const { cx, cy, cz } = message;

    // Validate render distance (don't trust client)
    const maxRenderDistance = SERVER_CONFIG.maxRenderDistance || 7;
    const playerChunkX = Math.floor(player.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(player.y / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.z / CHUNK_SIZE);
    
    const dx = cx - playerChunkX;
    const dy = cy - playerChunkY;
    const dz = cz - playerChunkZ;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance > maxRenderDistance) {
      log(`Rejected chunk request from ${player.username}: (${cx}, ${cy}, ${cz}) - distance ${distance.toFixed(1)} exceeds max ${maxRenderDistance}`, "WARN");
      return;
    }

    try {
      const chunk = player.world.getOrGenerateChunk(cx, cy, cz);
      
      if (!chunk.isEmpty()) {
        const buffer = ChunkProtocol.serializeChunk(chunk);
        player.ws.send(buffer);
        
        const chunkKey = `${cx},${cy},${cz}`;
        player.loadedChunks.add(chunkKey);
        log(`Sent chunk (${cx}, ${cy}, ${cz}) to ${player.username}`, "DEBUG");
      } else {
        log(`Chunk (${cx}, ${cy}, ${cz}) is empty, not sending`, "DEBUG");
      }
    } catch (err) {
      log(`Error handling chunk request from ${player.username}: ${err.message}`, "ERROR");
      error(`Stack trace: ${err.stack}`);
    }
  }

  handlePlayerDisconnect(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    log(`Player ${player.username} disconnected. Total players: ${this.players.size - 1}`);

    // Trigger mod system player leave event
    this.modSystem.onPlayerLeave(player);

    // Remove player
    this.players.delete(playerId);

    // Notify other players
    this.broadcastToOthers(playerId, {
      type: "player_left",
      id: playerId
    });
  }

  sendToPlayer(playerId, message) {
    const player = this.players.get(playerId);
    if (!player || !player.ws) return;

    try {
      if (typeof message === 'string') {
        player.ws.send(message);
      } else if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
        player.ws.send(message);
      } else {
        player.ws.send(JSON.stringify(message));
      }
    } catch (error) {
      log(`Error sending message to player ${playerId}: ${error.message}`, "ERROR");
    }
  }

  broadcast(message) {
    this.players.forEach((player) => {
      try {
        if (typeof message === 'string') {
          player.ws.send(message);
        } else if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
          player.ws.send(message);
        } else {
          player.ws.send(JSON.stringify(message));
        }
      } catch (error) {
        log(`Error broadcasting to player ${player.id}: ${error.message}`, "ERROR");
      }
    });
  }

  broadcastToOthers(excludePlayerId, message) {
    this.players.forEach((player, id) => {
      if (id === excludePlayerId) return;
      
      try {
        if (typeof message === 'string') {
          player.ws.send(message);
        } else if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
          player.ws.send(message);
        } else {
          player.ws.send(JSON.stringify(message));
        }
      } catch (error) {
        log(`Error broadcasting to player ${id}: ${error.message}`, "ERROR");
      }
    });
  }

  updatePlayerPosition(playerId, x, y, z) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.x = x;
    player.y = y;
    player.z = z;
  }
}

// Main server startup
async function main() {
  showVasteAscii();
  
  log("Starting Vaste Game Server...");
  
  // Load configuration
  loadConfig();
  
  // Validate license
  try {
    log("Validating license...");
    await validateLicense();
    log("License validated successfully");
  } catch (error) {
    log(`License validation failed: ${error.message}`, "ERROR");
    log("Server will not start without valid license", "ERROR");
    process.exit(1);
  }

  // Create server instance
  const server = new GameServer();

  // Start heartbeat
  setInterval(async () => {
    try {
      await sendHeartbeat(server.players.size);
    } catch (error) {
      log(`Heartbeat failed: ${error.message}`, "WARN");
    }
  }, 60000); // Every minute

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM signal received, shutting down server...');
    
    // Save all worlds
    if (server.modSystem && server.modSystem.worldManager) {
      server.modSystem.worldManager.saveAll();
    }
    
    process.exit(0);
  });

  process.on('SIGINT', () => {
    log('SIGINT signal received, shutting down server...');
    
    // Save all worlds
    if (server.modSystem && server.modSystem.worldManager) {
      server.modSystem.worldManager.saveAll();
    }
    
    process.exit(0);
  });
}

// Start server
main().catch((error) => {
  log(`Fatal error: ${error.message}`, "ERROR");
  process.exit(1);
});
