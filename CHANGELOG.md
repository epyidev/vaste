# Changelog

All notable changes to the Vaste project will be documented in this file.

## [2.0.0] - 2025-10-05

### 🚀 Major Release - World System v2

Complete rewrite of the voxel world system with cubic chunks, region-based storage, and mod-driven world creation.

### Added

#### Server
- **World System v2** (`gameserver/world-v2/`)
  - `Chunk.js` - Cubic 16×16×16 chunk implementation with Uint16Array storage
  - `Region.js` - Region container for 32×32×32 chunks (sparse storage)
  - `World.js` - Main world manager with auto-save and chunk generation
  - `WorldStorage.js` - Disk persistence using region files
  - `GeneratorRegistry.js` - Extensible generator system
  - `ChunkProtocol.js` - Binary network protocol for efficient chunk transmission
  - `generators/FlatworldGenerator.js` - Configurable flatworld generator
  
- **New Server** (`gameserver/server-v2.js`)
  - Complete server rewrite (814 lines)
  - License validation and authentication
  - World assignment check before player spawn
  - NO_WORLD error handling
  - Spiral chunk loading pattern (closest first)
  - Binary chunk protocol integration
  
- **Lua API** (`gameserver/vaste-api/`)
  - `world/WorldManager.js` - World management for mods
  - `CreateOrLoadWorld(savePath, generatorType)` - Create/load worlds
  - `SetEntityInWorld(entity, world)` - Assign entities to worlds
  - Updated entity management for new world system
  - Generator registry access from Lua

#### Client
- **Game Component v2** (`app/client/src/GameV2.tsx`)
  - Complete game component rewrite (277 lines)
  - Player physics (movement, gravity, jumping)
  - Keyboard controls (WASD, Space)
  - PointerLockControls integration
  - Loading states (connecting, waiting for world)
  - HUD (position, chunks, players)
  
- **Network Manager v2** (`app/client/src/networkV2.ts`)
  - Binary message handling
  - ChunkDecoderWorker integration
  - World assignment detection
  - Chunk and player state management
  
- **Chunk Management** (`app/client/src/ChunkManager.ts`)
  - Client-side chunk storage
  - Mesh generation queue
  - Version tracking for invalidation
  - Neighbor mesh invalidation
  
- **World Renderer v2** (`app/client/src/components/OptimizedWorldV2.tsx`)
  - React Three.js renderer for cubic chunks
  - ChunkManager integration
  - Visibility culling
  - Dynamic mesh generation
  
- **Web Workers**
  - `workers/chunkDecoderWorker.ts` - Off-thread binary chunk decoding
  - `workers/chunkMeshWorker.ts` - Off-thread mesh generation with face culling
  
- **Type Definitions** (`app/client/src/typesV2.ts`)
  - ChunkData, Block, PlayerData types
  - MessageType enum
  - ChunkKey and ChunkCoords utilities
  - FaceDirection with normals and vertices
  - DEFAULT_RENDER_CONFIG

#### Documentation
- `WORLD_V2_README.md` - Complete technical documentation (398 lines)
- `MIGRATION_GUIDE.md` - Migration guide from v1 to v2 (297 lines)
- `IMPLEMENTATION_SUMMARY.md` - Implementation details (419 lines)
- `MIGRATION_STATUS.md` - Migration status and checklist
- `QUICK_START.md` - Quick start guide
- `gameserver/archive/README.md` - Archive documentation
- `app/client/src/archive/README.md` - Client archive documentation

### Changed

#### Server
- **package.json**
  - Version: `1.0.0` → `2.0.0`
  - Main: `server.js` → `server-v2.js`
  - Start script now runs `server-v2.js`
  - Added `start:old` script for v1 rollback
  
- **README.md**
  - Updated with World System v2 information
  - Added architecture diagram
  - Added mod API examples
  - Added documentation links

#### Client
- **GamePage.tsx**
  - Simplified to use GameV2 component
  - Removed old NetworkManager state management
  - GameV2 handles connection internally

### Deprecated

The following v1 files are deprecated and archived:

#### Server
- `server.js` → `archive/server-v1.js`
- `clientStateManager.js` → `archive/clientStateManager-v1.js`
- `world/ChunkStore.js` → `archive/world-v1/ChunkStore.js`
- `world/chunkGenerator.js` → `archive/world-v1/chunkGenerator.js`
- `world/chunkSerializer.js` → `archive/world-v1/chunkSerializer.js`
- All worker pool files → `archive/world-v1/`

#### Client
- `Game.tsx` → `archive/Game-v1.tsx`
- `network.ts` → `archive/network-v1.ts`
- `types.ts` → `archive/types-v1.ts`
- `components/OptimizedWorld.tsx` → `archive/OptimizedWorld-v1.tsx`

### Removed

- Old client state files (moved to `archive/client_state_old/`)
- Old world data (column-based chunks incompatible with v2)

### Fixed

- **Chunk System**
  - Fixed column-based chunks (16×256×16) → Now cubic chunks (16×16×16)
  - Fixed thousands of individual chunk files → Now region files (32×32×32 chunks)
  - Fixed hardcoded world generation → Now extensible generator registry
  - Fixed automatic player spawning → Now mod-controlled via CreateOrLoadWorld
  
- **Network Protocol**
  - Fixed mixed JSON/binary formats → Now consistent binary protocol
  - Fixed inefficient chunk transmission → Now 8205 bytes per chunk (predictable)
  - Fixed main thread blocking → Now Web Workers for decoding/meshing
  
- **Architecture**
  - Fixed tight coupling → Now clean separation of concerns
  - Fixed no mod API → Now complete Lua API for world management
  - Fixed no world persistence → Now auto-save every 30 seconds

### Breaking Changes

⚠️ **v1 to v2 is a breaking change**

- Old world data is **NOT compatible** with v2
- Client and server **must both** use v2
- Mods **must** call `CreateOrLoadWorld()` before players can spawn
- Network protocol completely changed (binary format)

See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for migration instructions.

### Performance Improvements

- **Server**
  - Region files reduce filesystem overhead
  - Binary protocol reduces bandwidth usage
  - Sparse chunk storage saves memory
  - Auto-save batching reduces I/O
  
- **Client**
  - Web Workers prevent main thread blocking
  - Face culling reduces triangle count
  - Mesh generation queue prevents worker overload
  - Version tracking prevents unnecessary regeneration

### Known Issues

- Collision detection not implemented (players fall through blocks)
- Texture atlas not implemented (solid color rendering)
- Block placement UI not connected
- Multiplayer entity rendering not implemented
- Lighting system not implemented (ambient only)

See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for details.

### Rollback

If you need to revert to v1, see the "Rollback Plan" section in [MIGRATION_STATUS.md](MIGRATION_STATUS.md).

---

## [1.0.0] - Previous Version

Initial release with column-based chunk system (archived).

### Features (v1)
- Column-based chunks (16×256×16)
- Hardcoded flatworld generation
- Basic multiplayer support
- React + Three.js client
- WebSocket server
- MySQL backend

### Known Issues (v1)
- Thousands of chunk files created
- No world persistence
- No mod API
- Hardcoded world generation
- Performance issues with many chunks
- Mixed network protocol formats

---

**Migration Status:** v1 → v2 complete  
**Current Version:** 2.0.0  
**Migration Date:** October 5, 2025
