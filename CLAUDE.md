# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vaste is a multiplayer voxel game built with React, Three.js, and Node.js. The project consists of three main components:

1. **Unified App** ([/app](app/)) - Express.js backend + React/Three.js frontend (port 8080)
2. **Game Server** ([/gameserver](gameserver/)) - WebSocket-based voxel game server (port 25565)
3. **Database** - MySQL 8.0+ for user authentication and server listing

## Common Commands

### Initial Setup
```bash
# Windows: Automated setup and launch
./start.bat

# Linux/Mac: Manual setup
cd app
npm install
cd ../gameserver/vaste
npm install
cd ../..
```

### Development - Unified App (Backend + Frontend)
```bash
cd app

# Development mode (hot reload for both backend and frontend)
npm run dev

# Development mode - backend only
npm run dev:server

# Development mode - frontend only
npm run dev:client

# Production build
npm run build

# Production mode (requires build first)
npm start

# Build and start
npm run build:start

# Linting
npm run lint
```

### Development - Game Server
```bash
cd gameserver/vaste

# Start game server
npm start
# or
node server.js
```

### Database Setup
```bash
# Create database
mysql -u root -p
CREATE DATABASE vaste_backend;

# Configure .env in /app directory
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=vaste_backend
JWT_SECRET=your_secret_key
```

## Architecture

### Communication Flow
```
Browser (React + Three.js Client)
    ↓ HTTP/REST (Authentication, Server Listing)
Unified App Backend (Express.js on :8080)
    ↓ MySQL
Database (User Accounts, Server Registry)

Browser Client
    ↓ WebSocket (Game Protocol)
Game Server (WebSocket on :25565)
    ↓ File I/O
World Storage (Region Files)
```

### Unified App Structure ([/app](app/))

**Backend** ([/app/src](app/src/)):
- [server.js](app/server.js) - Express server with static file serving, API routing, and blockpack serving
- [src/routes/](app/src/routes/) - API routes (`auth.js`, `servers.js`, `gameServers.js`)
- [src/models/](app/src/models/) - Database models (`User.js`, `GameServer.js`)
- [src/middleware/](app/src/middleware/) - Authentication and validation middleware
- [src/config/](app/src/config/) - Database configuration

**Frontend** ([/app/client/src](app/client/src/)):
- [Game.tsx](app/client/src/Game.tsx) - Main game component with chunk management, render distance, and player state
- [network.ts](app/client/src/network.ts) - WebSocket protocol, chunk batching, and packet handling
- [ChunkManager.ts](app/client/src/ChunkManager.ts) - Client-side chunk storage and mesh generation
- [types.ts](app/client/src/types.ts) - Shared TypeScript types
- [components/](app/client/src/components/):
  - [PlayerController.tsx](app/client/src/components/PlayerController.tsx) - Player input and movement
  - [VoxelWorld.tsx](app/client/src/components/VoxelWorld.tsx) - World rendering with Three.js
  - [BlockSelector.tsx](app/client/src/components/BlockSelector.tsx) - Block selection UI
  - [OtherPlayers.tsx](app/client/src/components/OtherPlayers.tsx) - Multiplayer player rendering
  - [ui/](app/client/src/components/ui/) - UI components (chat, menus, screens)
- [physics/](app/client/src/physics/) - [VoxelPhysics.ts](app/client/src/physics/VoxelPhysics.ts) for player collision
- [rendering/](app/client/src/rendering/):
  - [chunks/ChunkManager.ts](app/client/src/rendering/chunks/ChunkManager.ts) - Render chunk management
  - [geometry/GeometryBuilder.ts](app/client/src/rendering/geometry/GeometryBuilder.ts) - Mesh generation
- [workers/](app/client/src/workers/) - Web Workers for chunk decoding and mesh generation
- [pages/](app/client/src/pages/) - React Router pages (login, server list, game, etc.)

### Game Server Structure ([/gameserver](gameserver/))

**Core Server** ([/gameserver/vaste](gameserver/vaste/)):
- [server.js](gameserver/vaste/server.js) - Main WebSocket server with chunk streaming, player management, and mod integration
- [VasteModSystem.js](gameserver/vaste/VasteModSystem.js) - Lua-based modding system using Fengari
- [BlockRegistry.js](gameserver/vaste/BlockRegistry.js) - Block type management
- [BlockpackManager.js](gameserver/vaste/BlockpackManager.js) - Blockpack loading and validation
- [world/](gameserver/vaste/world/) - World generation, chunk storage (region files), and chunk protocol
- [vaste-api/](gameserver/vaste/vaste-api/) - Lua modding API (world, entity, events, math modules)

**Mods** ([/gameserver/mods](gameserver/mods/)):
- Lua-based mods with `init.lua` entry point
- Access to Vaste API for world generation, entity management, and event handling

**Configuration** ([server-config.json](gameserver/server-config.json)):
```json
{
  "wsPort": 25565,
  "httpPort": 25566,
  "license_key": "vaste_...",
  "max_players": 193,
  "maxRenderDistance": 16,
  "forceRenderDistance": false
}
```

### Key Technical Systems

**Chunk System**:
- Cubic chunks (16x16x16 blocks)
- Client-side batching (16 chunks per batch, 50ms window)
- Server-side streaming (8 chunks per batch, priority queue)
- Binary protocol for efficient transmission
- Web Workers for async decoding and mesh generation

**Networking**:
- Message priority system (block actions bypass queue)
- Movement suppression (0.05m threshold, 1s keepalive)
- Packet logging for debugging
- High-priority: block_place, block_break, player_move
- Low-priority: chunk_request (batched and queued)

**World Storage**:
- Region-based storage (32x32 chunks per region file)
- Location in [/gameserver/mods/{mod}/flatworld/regions/](gameserver/mods/test/flatworld/regions/)
- Format: `r.{rx}.{ry}.{rz}.dat` (gzip-compressed JSON)

**Mod System**:
- Lua-based using Fengari (Lua 5.3 in JavaScript)
- Event-driven architecture (block_place, block_break, player_join, etc.)
- Custom world generators via `vaste.world.registerGenerator()`
- API modules: world, entity, events, math

**Physics**:
- Client-side AABB collision detection
- Safety mechanisms for missing chunks
- View bobbing and cinematic camera modes

**Rendering**:
- Three.js with @react-three/fiber
- Greedy meshing for face culling
- Ambient occlusion (toggleable)
- Dynamic shadows (toggleable)
- Texture atlas from blockpacks

## Development Notes

### Frontend Development
- Client code uses TypeScript with strict types
- Three.js objects managed through React refs
- Web Workers handle heavy computation (chunk decoding, mesh generation)
- Settings stored in localStorage (renderDistance, shadows, mouseSensitivity, etc.)

### Backend Development
- Express.js with ES modules (type: "module" in package.json)
- JWT-based authentication
- Rate limiting and helmet security
- Database models use mysql2 with async/await

### Game Server Development
- Pure JavaScript (Node.js)
- WebSocket protocol with binary chunk data
- Mods live in [/gameserver/mods](gameserver/mods/) with `init.lua`
- World data persists in region files
- Block IDs managed through BlockRegistry

### Testing
- Open browser to http://localhost:8080
- Create account or login
- Connect to ws://localhost:25565
- Use F3 for debug info (position, chunk, FPS)

### Blockpacks
- Located in [/app/client/public/blockpacks/](app/client/public/blockpacks/)
- Each blockpack has a `block.json` manifest
- Textures shared in [/app/client/public/textures/](app/client/public/textures/)
- Server dynamically builds index at `/blockpacks/index.json`

## Important Patterns

### When modifying chunk protocol:
1. Update both [network.ts](app/client/src/network.ts) (client) and [server.js](gameserver/vaste/server.js) (game server)
2. Binary protocol uses DataView for packing/unpacking
3. Chunk format: header (cx, cy, cz, version) + block data (Uint16Array)

### When adding new block types:
1. Add to blockpack `block.json` in [/app/client/public/blockpacks/](app/client/public/blockpacks/)
2. Textures in [/app/client/public/textures/](app/client/public/textures/)
3. Client will auto-load via BlockRegistry

### When creating mods:
1. Create directory in [/gameserver/mods/](gameserver/mods/)
2. Add `init.lua` with mod initialization
3. Register event handlers with `vaste.events.on()`
4. Use `vaste.world`, `vaste.entity` APIs

### When adding API endpoints:
1. Create route in [/app/src/routes/](app/src/routes/)
2. Add middleware for authentication if needed
3. Import and mount in [server.js](app/server.js)
4. Update README if part of public API

## Performance Considerations

- Chunk streaming: ~200 chunks/second (game server)
- Block actions: <1ms latency (high priority)
- Initial load (5³ = 125 chunks): ~625ms
- Empty chunks cached for instant serialization
- Mesh generation offloaded to Web Workers
- Physics runs at 60 FPS with chunk safety checks


## Règles à réspecter lors des modifications :
- Soit très rigoureux, n'hésites pas à beaucoup analyser les fichiers avant d'agir.
- Code de manière profesionnelle.
- Que des commentaires en anglais, l'anglais est la seule langue que tu dois utiliser.
- N'utilise jamais d'emoji.
- Tu es libre, tu peux modifier des fichiers entier, en supprimer, en recréer de zéro si nécéssaire.
- Ne crée jamais de doc de type summary, explication en .md, ou autre commentaire trop long.