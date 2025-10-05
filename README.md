# Vaste

A multiplayer voxel game built with React and Node.js. Create an account, connect to servers, and build together in real-time.

**🚀 Featuring cubic chunks, region-based storage, and mod-driven world creation!**

## Quick Start

See [QUICK_START.md](QUICK_START.md) for detailed instructions.

### Requirements
- Node.js 18+
- MySQL 8.0+

### Setup
1. Create a MySQL database called `vaste_backend`
2. Create a `.env` file in `/app`:
```
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=vaste_backend
JWT_SECRET=your_secret_key
```

### Launch

**Option 1: Use the startup script (runs both servers)**
```bash
./start.bat
```

**Option 2: Manual start**

Terminal 1 - Backend API:
```bash
cd app
npm install
npm run dev
```

Terminal 2 - Game Server:
```bash
cd gameserver
npm install
npm start
```

Then open **http://localhost:5173** and play!

## Architecture

- `/app` - Express.js backend API + React frontend with Vite
  - Backend: `app/server.js` (port 3000)
  - Frontend: `app/client/` (port 5173 in dev)
  
- `/gameserver` - Game server with World System
  - Server: `gameserver/server.js` (WebSocket, port 8080)
  - World System: `gameserver/world/` (cubic chunks, regions)
  - Mods: `gameserver/mods/` (Lua mods with fengari)

## World System

### Features

- ✅ **Cubic Chunks:** 16×16×16 blocks per chunk
- ✅ **Region Storage:** 32×32×32 chunks per region file (512³ blocks)
- ✅ **Extensible Generators:** Mod-driven world generation
- ✅ **Binary Protocol:** Efficient network communication
- ✅ **Mod-Controlled Spawning:** No player spawn without world creation
- ✅ **Web Workers:** Off-main-thread chunk decoding and mesh generation
- ✅ **Auto-Save:** World persistence every 30 seconds

### Documentation

- **[WORLD_SYSTEM.md](WORLD_SYSTEM.md)** - Complete technical documentation
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration from v1 to v2
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Implementation details
- **[MIGRATION_STATUS.md](MIGRATION_STATUS.md)** - Migration status and checklist
- **[QUICK_START.md](QUICK_START.md)** - Quick start guide

### What's New in v2

| Feature | v1 | v2 |
|---------|----|----|
| Chunks | Column-based (16×256×16) | Cubic (16×16×16) |
| Storage | Individual files | Region files |
| Generation | Hardcoded | Extensible registry |
| Protocol | Mixed JSON/binary | Pure binary |
| Workers | None | Decoder + Mesh workers |

## Creating Worlds (Mod API)

Edit `gameserver/mods/test/server/main.lua`:

```lua
-- Create or load a world
local world = CreateOrLoadWorld("savedworld/myworld", "flatworld")

-- Handle player joins
AddEventListener("onPlayerJoin", function(player)
    local playerEntity = GetPlayerEntity(player)
    SetEntityInWorld(playerEntity, world)
    SetEntityCoords(playerEntity, vec3(0, 50, 0))
end)
```

## Project Structure

```
vaste/
├── app/
│   ├── server.js              # Backend API server
│   ├── client/                # React frontend
│   │   ├── src/
│   │   │   ├── Game.tsx     # Main game component
│   │   │   ├── network.ts   # Network manager
│   │   │   ├── types.ts     # Type definitions
│   │   │   ├── ChunkManager.ts # Client chunk management
│   │   │   └── components/
│   │   │       └── OptimizedWorld.tsx  # World renderer
│   │   └── workers/
│   │       ├── chunkDecoderWorker.ts     # Binary decoder
│   │       └── chunkMeshWorker.ts        # Mesh generator
│   └── database/
│       └── migrations/
├── gameserver/
│   ├── server.js           # Game server v2
│   ├── world/              # World System
│   │   ├── Chunk.js           # Cubic chunk implementation
│   │   ├── Region.js          # Region storage
│   │   ├── World.js           # World manager
│   │   ├── WorldStorage.js    # Disk persistence
│   │   ├── GeneratorRegistry.js # Generator system
│   │   ├── ChunkProtocol.js   # Binary protocol
│   │   └── generators/
│   │       └── FlatworldGenerator.js
│   ├── vaste-api/             # Lua API
│   │   ├── world/
│   │   │   └── WorldManager.js
│   │   └── entity/
│   ├── VasteModSystem.js      # Mod loader
│   ├── mods/
│   │   └── test/
│   │       └── server/
│   │           └── main.lua   # Test mod
│   └── archive/               # Old v1 files
└── docs/
    ├── WORLD_SYSTEM.md
    ├── MIGRATION_GUIDE.md
    ├── IMPLEMENTATION_SUMMARY.md
    ├── MIGRATION_STATUS.md
    └── QUICK_START.md
```
