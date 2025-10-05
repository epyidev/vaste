# Vaste Game Server v2

WebSocket-based game server with World System v2, featuring cubic chunks, region-based storage, and Lua modding support.

## Features

- **World System v2**
  - Cubic chunks (16×16×16 blocks)
  - Region-based storage (32×32×32 chunks per file)
  - Extensible generator system
  - Auto-save every 30 seconds
  
- **Lua Modding**
  - fengari-based Lua runtime
  - Complete API for world management
  - Event system for player joins/leaves
  - Entity management
  
- **Network Protocol**
  - Binary chunk transmission (8205 bytes per chunk)
  - Efficient block updates (15 bytes per block)
  - WebSocket communication
  - License validation

## Quick Start

```bash
npm install
npm start
```

Server will start on **port 8080** (WebSocket)

## Configuration

Edit `server-v2.js`:

```javascript
const port = 8080;                  // WebSocket port
const renderDistanceChunks = 8;     // Chunks to send to clients
const autoSaveInterval = 30000;     // Auto-save every 30s
```

## Project Structure

```
gameserver/
├── server-v2.js              # Main server (use this!)
├── package.json              # Dependencies
├── world-v2/                 # World System v2
│   ├── Chunk.js              # Cubic chunk implementation
│   ├── Region.js             # Region container
│   ├── World.js              # World manager
│   ├── WorldStorage.js       # File persistence
│   ├── GeneratorRegistry.js  # Generator system
│   ├── ChunkProtocol.js      # Binary protocol
│   └── generators/
│       └── FlatworldGenerator.js
├── vaste-api/                # Lua API
│   ├── world/
│   │   └── WorldManager.js   # World management
│   ├── entity/
│   │   └── index.js          # Entity management
│   └── events/
│       └── index.js          # Event system
├── VasteModSystem.js         # Mod loader
├── mods/                     # Lua mods
│   └── test/
│       ├── _heyvaste.lua     # Mod manifest
│       └── server/
│           └── main.lua      # Server-side mod
└── archive/                  # Old v1 files
    ├── server-v1.js
    ├── world-v1/
    └── README.md
```

## Creating Mods

Create a folder in `mods/`:

```
mods/mymod/
├── _heyvaste.lua       # Manifest
└── server/
    └── main.lua        # Server-side script
```

**_heyvaste.lua:**
```lua
name("mymod")
description("My awesome mod")
version("1.0.0")
author("YourName")

load_server_script("server/main.lua")
```

**server/main.lua:**
```lua
print("My mod loaded!")

-- Create or load a world
local world = CreateOrLoadWorld("savedworld/myworld", "flatworld")

-- Handle player joins
AddEventListener("onPlayerJoin", function(player)
    local playerEntity = GetPlayerEntity(player)
    SetEntityInWorld(playerEntity, world)
    SetEntityCoords(playerEntity, vec3(0, 50, 0))
    print("Player joined: " .. GetPlayerName(player))
end)
```

## Lua API

### World Management

```lua
-- Create or load a world
local world = CreateOrLoadWorld(savePath, generatorType)
-- savePath: relative to mod folder (e.g., "savedworld/myworld")
-- generatorType: "flatworld" or custom registered generator

-- Fill blocks in world
FillBlocksInWorld(world, x1, y1, z1, x2, y2, z2, blockType)

-- Set entity in world
SetEntityInWorld(entity, world)
```

### Entity Management

```lua
-- Get player entity
local entity = GetPlayerEntity(player)

-- Set entity coordinates
SetEntityCoords(entity, vec3(x, y, z))

-- Get entities in world
local entities = GetEntitiesInWorld(world)
```

### Events

```lua
-- Player join
AddEventListener("onPlayerJoin", function(player)
    -- player joined
end)

-- Player leave
AddEventListener("onPlayerLeave", function(player)
    -- player left
end)
```

### Generator Registry

```lua
-- Register custom generator
local myGenerator = {
    generate = function(chunk)
        -- Generate chunk blocks
        -- chunk has cx, cy, cz, blocks
    end
}
RegisterGenerator("mygenerator", myGenerator)
```

## World Data

Worlds are saved in the mod folder:

```
mods/mymod/savedworld/myworld/
├── r.0.0.0.dat      # Region file (32×32×32 chunks)
├── r.1.0.0.dat
└── metadata.json    # Spawn point, generator type
```

## Binary Protocol

### CHUNK_DATA (type 2)
```
[1 byte]  MessageType (2)
[4 bytes] cx (chunk X)
[4 bytes] cy (chunk Y)
[4 bytes] cz (chunk Z)
[4 bytes] version
[8192 bytes] blocks (4096 × uint16)
Total: 8205 bytes
```

### CHUNK_UPDATE (type 3)
```
[1 byte]  MessageType (3)
[4 bytes] x (world X)
[4 bytes] y (world Y)
[4 bytes] z (world Z)
[2 bytes] blockType
Total: 15 bytes
```

### JSON Messages

**world_assign:**
```json
{
  "type": "world_assign",
  "generatorType": "flatworld",
  "spawnPoint": {"x": 0, "y": 50, "z": 0}
}
```

**player_joined:**
```json
{
  "type": "player_joined",
  "id": "uuid",
  "username": "player",
  "x": 0, "y": 50, "z": 0
}
```

**error:**
```json
{
  "type": "error",
  "code": "NO_WORLD",
  "message": "No active world"
}
```

## Architecture

### World System Flow

1. Mod calls `CreateOrLoadWorld()`
2. WorldManager creates World instance
3. World loads regions from disk (if exist)
4. Generator creates new chunks as needed
5. Chunks saved to region files every 30s

### Player Join Flow

1. Client connects via WebSocket
2. Server validates license
3. Server authenticates with backend API
4. Server checks if world exists
   - If no world: send `NO_WORLD` error
   - If world exists: send `world_assign` message
5. Mod's `onPlayerJoin` event fires
6. Mod calls `SetEntityInWorld()`
7. Server sends nearby chunks in spiral pattern
8. Player spawns and can play

### Chunk Loading

1. Player position determines center chunk
2. Server calculates nearby chunks (spiral pattern)
3. Server generates missing chunks using generator
4. Server serializes chunks with ChunkProtocol
5. Server sends binary CHUNK_DATA messages
6. Client receives and renders chunks

## Performance

**Chunk Generation:** ~0.1ms per chunk (flatworld)  
**Chunk Serialization:** ~0.5ms per chunk  
**Region Save:** ~10ms per region (32k chunks)  
**Network:** 8205 bytes per chunk, 15 bytes per block update

## Troubleshooting

### Server won't start
- Check Node.js version (>=16)
- Check `npm install` completed
- Check port 8080 not in use

### "No active world" error
- Mod must call `CreateOrLoadWorld()`
- Check mod is loaded: console should show "Test mod loaded"
- Check `mods/test/server/main.lua` exists

### Chunks not saving
- Check disk space
- Check write permissions to mod folder
- Server logs should show "World saved: testworld"

### Players can't join
- Check WebSocket connection (port 8080)
- Check backend API running (port 3000)
- Check license validation succeeded
- Check world was created by mod

## Migration from v1

The server now uses `server-v2.js` by default.

**Old v1 files archived in:** `archive/`

**To rollback to v1:**
```bash
cp archive/server-v1.js server.js
cp -r archive/world-v1/* world/
# Edit package.json: "main": "server.js"
```

See `/MIGRATION_GUIDE.md` for full details.

## Documentation

- **Technical Details:** `/WORLD_V2_README.md`
- **Migration Guide:** `/MIGRATION_GUIDE.md`
- **Implementation Summary:** `/IMPLEMENTATION_SUMMARY.md`
- **Quick Start:** `/QUICK_START.md`

## Dependencies

- `ws` - WebSocket library
- `fengari` - Lua runtime in JavaScript
- `fengari-interop` - Lua/JS interop
- `uuid` - UUID generation

## License

MIT
