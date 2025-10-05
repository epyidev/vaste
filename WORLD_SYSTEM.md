# Vaste World System

Complete rewrite of the voxel world system with cubic chunks, region-based storage, and mod-driven world creation.

## Architecture Overview

### Cubic Chunks
- **16x16x16 blocks** per chunk (not column-based)
- Uint16Array storage (4096 blocks per chunk)
- Version tracking for mesh invalidation
- Local coordinate system (0-15 in each axis)

### Region System
- **32x32x32 chunks** per region file (512x512x512 blocks)
- Sparse storage using Map (only saves non-empty chunks)
- Region files: `r.{rx}.{ry}.{rz}.dat`
- Reduces file count from thousands to manageable amount

### Generator Registry
- Extensible generator system
- Mods can register custom generators
- Built-in generators: flatworld (configurable layers)
- Generator selection via CreateOrLoadWorld() API

## Server Components

### Core World System (`gameserver/world/`)

**Chunk.js**
- Cubic 16x16x16 chunk implementation
- Uint16Array storage with linear indexing: `((y*16+z)*16)+x`
- serialize/deserialize for network and disk
- Version tracking for client updates

**Region.js**
- Container for 32x32x32 chunks
- Sparse Map storage (chunkKey -> Chunk)
- Serialize with chunk count header
- Deserialize rebuilding sparse structure

**World.js**
- Main world manager
- getOrGenerateChunk() using generator registry
- setBlock/getBlock with coordinate conversion
- Auto-save every 30 seconds
- getChunksInRange() for player loading

**WorldStorage.js**
- Disk persistence using region files
- loadRegion/saveRegion with binary format
- listRegions() for world scanning
- Metadata support (spawn points, generator type)

**GeneratorRegistry.js**
- Singleton pattern for generator management
- register(name, generator) and get(name)
- Default generators: flatworld

**generators/FlatworldGenerator.js**
- Configurable layer system
- Default: grass(1), dirt(3), stone(60)
- Flat terrain for testing and simple worlds

### Network Protocol (`gameserver/world/ChunkProtocol.js`)

**Binary Format**
- CHUNK_DATA (type 2): 8205 bytes
 - MessageType (1 byte)
 - cx, cy, cz (4 bytes each)
 - version (4 bytes)
 - blocks (4096 * 2 bytes = 8192 bytes)

- CHUNK_UPDATE (type 3): 15 bytes
 - MessageType (1 byte)
 - x, y, z (4 bytes each)
 - blockType (2 bytes)

**Methods**
- serializeChunk(chunk): Buffer
- deserializeChunk(buffer): {cx, cy, cz, version, blocks}
- serializeBlockUpdate(x, y, z, blockType): Buffer
- deserializeBlockUpdate(buffer): {x, y, z, blockType}

### Lua API (`gameserver/vaste-api/`)

**WorldManager.js**
- createOrLoadWorld(savePath, generatorType): Creates or loads world
- fillBlocksInWorld(world, x1, y1, z1, x2, y2, z2, blockType): Fill region
- saveAll(): Save all active worlds
- cleanup(): Graceful shutdown

**VasteModSystem Integration**
- CreateOrLoadWorld(savePath, generatorType) - Exposed to Lua
- SetEntityInWorld(entity, world) - Assign player to world
- registerGenerator(name, generator) - Custom generators
- getGeneratorRegistry() - Access registry from Lua

### Server (`gameserver/server.js`)

**Authentication Flow**
1. Client connects
2. Send auth_info with token
3. handleAuthentication validates with backend
4. initializeAuthenticatedPlayer checks worldState
5. If no world: send error {type: "error", code: "NO_WORLD"}
6. If world exists: send world_assign message

**World Assignment**
```javascript
{
 type: "world_assign",
 generatorType: "flatworld",
 spawnPoint: { x: 0, y: 65, z: 0 }
}
```

**Chunk Loading**
- sendNearbyChunks() sends chunks in spiral pattern
- Closest chunks first (Manhattan distance)
- renderDistanceChunks configurable (default 8)
- Binary CHUNK_DATA messages

**Block Updates**
- handleBlockUpdate() processes place/break
- ChunkProtocol.serializeBlockUpdate()
- Broadcast to all players in world

## Client Components

### Network (`app/client/src/.ts`)

****
- WebSocket connection with binary support
- chunkDecoderWorker for off-main-thread decoding
- handleWorldAssign() triggers spawn
- handleChunkData() stores chunks
- handleBlockUpdate() updates chunk versions

****
```typescript
{
 playerId: string | null;
 players: Map<string, PlayerData>;
 chunks: Map<string, ChunkData>;
 connected: boolean;
 worldAssigned: boolean;
 spawnPoint: {x, y, z} | null;
 generatorType: string | null;
}
```

### Workers

**chunkDecoderWorker.ts**
- Decodes CHUNK_DATA messages (8205 bytes)
- Parses cx, cy, cz, version, blocks array
- Converts to sparse block list for rendering
- Decodes CHUNK_UPDATE messages (15 bytes)

**chunkMeshWorker.ts**
- Generates optimized meshes from chunk data
- Face culling against neighbor chunks
- Outputs positions, normals, uvs, indices, blockTypes
- Runs off main thread for performance

### Chunk Management (`app/client/src/ChunkManager.ts`)

**ChunkManager**
- Client-side chunk storage (Map<chunkKey, ChunkData>)
- Mesh generation queue with worker coordination
- Version tracking for mesh invalidation
- invalidateChunkAndNeighbors() for block updates

**Methods**
- setChunk(chunkData): Add/update chunk
- requestMesh(cx, cy, cz, callback): Generate mesh
- getMesh(cx, cy, cz): Get cached mesh
- hasMesh(cx, cy, cz): Check if mesh is up to date

### Rendering (`app/client/src/components/.tsx`)

** Component**
- React + @react-three/fiber rendering
- ChunkManager integration
- Visibility culling based on render distance
- Dynamic mesh generation and disposal
- Three.js BufferGeometry per chunk

**Props**
- chunks: Map<string, ChunkData>
- playerPosition: {x, y, z}
- renderDistance: {horizontal, vertical}
- textureAtlas?: THREE.Texture

### Game Loop (`app/client/src/.tsx`)

** Component**
- integration
- Player physics (movement, gravity, jumping)
- Keyboard controls (WASD, Space)
- PointerLockControls for mouse look
- Loading states (connecting, waiting for world)
- HUD display (position, chunks, players)

**Loading Flow**
1. "Connecting to server..."
2. "Waiting for world assignment..."
3. If NO_WORLD: Show message about mod creation
4. On world_assign: Spawn player and start rendering

## Types (`app/client/src/.ts`)

**Core Types**
- Block: {x, y, z, type}
- ChunkData: {cx, cy, cz, version, blocks, blocksArray}
- PlayerData: {id, username, x, y, z}
- ChunkMesh: {positions, normals, uvs, indices, blockTypes}

**Utilities**
- ChunkKey: toString(), fromString(), fromWorldCoords()
- ChunkCoords: worldToChunk(), worldToLocal(), localToWorld()
- FaceDirection enum with FACE_NORMALS and FACE_VERTICES

**Constants**
- CHUNK_SIZE = 16
- REGION_SIZE = 32
- DEFAULT_RENDER_CONFIG: {horizontalDistance: 8, verticalDistance: 4}

## Mod Integration

### Example: Creating a World

**mods/test/server/init.lua**
```lua
-- Create or load world
local world = CreateOrLoadWorld("savedworld/testworld", "flatworld")

-- On player join
OnPlayerJoin(function(player)
 -- Assign player to world
 SetEntityInWorld(player, world)
 
 -- Player will spawn at world's spawn point
end)
```

### No World Scenario
If no mod creates a world:
1. Player connects and authenticates
2. Server checks worldState (null)
3. Server sends error: {type: "error", code: "NO_WORLD"}
4. Client displays: "Waiting for the server mod to create a world..."
5. Player stays in loading state until mod calls CreateOrLoadWorld()

## File Structure

```
gameserver/
 world/
  Chunk.js          - Cubic chunk implementation
  Region.js          - Region container
  World.js          - World manager
  WorldStorage.js       - Disk persistence
  GeneratorRegistry.js    - Generator system
  ChunkProtocol.js      - Binary network protocol
  index.js          - Entry point
  generators/
   FlatworldGenerator.js   - Flat terrain generator
 vaste-api/
  world/
   WorldManager.js      - Lua world API
   index.js         - Export WorldManager
  entity/
   index.js         - Entity management
 VasteModSystem.js       - Mod loader with API bindings
 server.js         - Complete server rewrite

app/client/src/
 .ts         - Network manager
 .ts          - Type definitions
 ChunkManager.ts        - Client chunk management
 .tsx          - Main game component
 components/
  .tsx    - World renderer
 workers/
  chunkDecoderWorker.ts    - Binary decoder
  chunkMeshWorker.ts     - Mesh generator
```

## Migration from Old System

### Differences

**Old System**
- Column-based chunks (16x256x16)
- No region files (one file per chunk)
- Hardcoded flatworld in ChunkGenerator
- Players spawn without world check
- Mixed compression formats

**New System**
- Cubic chunks (16x16x16)
- Region files (32x32x32 chunks)
- Extensible generator registry
- Mod-driven world creation
- Simple binary protocol

### Migration Steps

1. Stop old server
2. Back up old world data
3. Update GamePage to use 
4. Update server startup to use server.js
5. Update mod to call CreateOrLoadWorld()
6. Test world creation and spawning

## Performance Considerations

### Server
- Auto-save every 30 seconds (configurable)
- Sparse region storage (empty chunks not saved)
- Binary protocol reduces bandwidth
- Spiral chunk loading prioritizes nearby chunks

### Client
- Web Workers for decoding and meshing (off main thread)
- Mesh generation queue prevents worker overload
- Face culling reduces triangle count
- Version tracking prevents unnecessary regeneration
- Geometry disposal for unloaded chunks

## Testing Checklist

- [ ] World creation via CreateOrLoadWorld()
- [ ] Player spawn at correct location
- [ ] Chunk loading in spiral pattern
- [ ] Block placement updates mesh
- [ ] Block breaking updates mesh
- [ ] Region file persistence
- [ ] World reload after server restart
- [ ] No-world scenario (loading screen)
- [ ] Multiple players in same world
- [ ] Neighbor chunk mesh invalidation

## Known Limitations

1. Texture atlas not implemented (solid color rendering)
2. Block outline for placement not connected
3. No collision detection (players fall through blocks)
4. No multiplayer entity rendering (other players)
5. No biomes or advanced terrain generation
6. No lighting system (ambient only)

## Future Improvements

- Greedy meshing for better performance
- Texture atlas with block variations
- Advanced generators (perlin noise, caves)
- Client-side prediction for block placement
- Chunk compression for network and disk
- LOD system for distant chunks
- Lighting propagation
- Physics/collision system
