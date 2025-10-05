# Migration Guide: World System v1 → v2

## Overview
This guide explains how to migrate from the old column-based world system to the new cubic chunk system v2.

## What Changed

### Server Side

**Old Files (Do NOT use)**
- `gameserver/world/ChunkStore.js` - Column-based chunks
- `gameserver/world/chunkGenerator.js` - Hardcoded flatworld
- `gameserver/server.js` - Old server with broken world system

**New Files (Use these)**
- `gameserver/world-v2/Chunk.js` - Cubic 16x16x16 chunks
- `gameserver/world-v2/Region.js` - Region system
- `gameserver/world-v2/World.js` - World manager
- `gameserver/world-v2/WorldStorage.js` - File persistence
- `gameserver/world-v2/GeneratorRegistry.js` - Extensible generators
- `gameserver/world-v2/generators/FlatworldGenerator.js` - Flatworld generator
- `gameserver/world-v2/ChunkProtocol.js` - Binary protocol
- `gameserver/vaste-api/world/WorldManager.js` - Lua API
- `gameserver/server-v2.js` - New server

### Client Side

**Old Files (Do NOT use)**
- `app/client/src/Game.tsx` - Old game component
- `app/client/src/network.ts` - Old network manager
- `app/client/src/components/OptimizedWorld.tsx` - Column-based rendering

**New Files (Use these)**
- `app/client/src/GameV2.tsx` - New game component
- `app/client/src/networkV2.ts` - New network manager
- `app/client/src/typesV2.ts` - Type definitions
- `app/client/src/ChunkManager.ts` - Chunk management
- `app/client/src/components/OptimizedWorldV2.tsx` - Cubic chunk rendering
- `app/client/src/workers/chunkDecoderWorker.ts` - Binary decoder
- `app/client/src/workers/chunkMeshWorker.ts` - Mesh generator

## Migration Steps

### Step 1: Update Mod Files

**Before (won't work):**
```lua
-- Old system had no world creation
OnPlayerJoin(function(player)
  -- Player just spawns automatically
end)
```

**After (required):**
```lua
-- Create world BEFORE players join
local world = CreateOrLoadWorld("savedworld/testworld", "flatworld")

OnPlayerJoin(function(player)
  -- Assign player to world
  SetEntityInWorld(player, world)
end)
```

**Important:** Without `CreateOrLoadWorld()`, players will be stuck in loading screen with message "Waiting for the server mod to create a world..."

### Step 2: Update Server Startup

**Before:**
```javascript
// gameserver/package.json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

**After:**
```javascript
// gameserver/package.json
{
  "scripts": {
    "start": "node server-v2.js",
    "start:old": "node server.js"  // Keep old as backup
  }
}
```

### Step 3: Update Client GamePage

**File:** `app/client/src/pages/GamePage.tsx`

**Before:**
```typescript
import { Game } from "../Game";

export function GamePage() {
  // ...
  return <Game serverUrl={serverUrl} user={user} />;
}
```

**After:**
```typescript
import { GameV2 } from "../GameV2";

export function GamePage() {
  // ...
  return <GameV2 serverUrl={serverUrl} user={user} />;
}
```

### Step 4: Test Migration

1. **Start new server:**
   ```bash
   cd gameserver
   npm start
   ```

2. **Start client:**
   ```bash
   cd app
   npm run dev
   ```

3. **Check console logs:**
   - Server should log: `[WorldManager] World created: testworld`
   - Client should log: `[NetworkV2] World assigned: flatworld`

4. **Verify player spawn:**
   - Player should spawn at correct location
   - Chunks should load in spiral pattern
   - HUD should show chunk count increasing

### Step 5: Verify Persistence

1. **Place some blocks** (when block placement is implemented)
2. **Stop server** (Ctrl+C)
3. **Check region files:**
   ```bash
   ls gameserver/mods/test/savedworld/testworld/
   # Should show: r.0.0.0.dat, r.1.0.0.dat, etc.
   ```
4. **Restart server**
5. **Reconnect client**
6. **Verify blocks are still there**

## Troubleshooting

### Problem: "Waiting for world assignment..." forever

**Cause:** Mod didn't call `CreateOrLoadWorld()`

**Solution:**
```lua
-- Add to your mod's server/init.lua
local world = CreateOrLoadWorld("savedworld/myworld", "flatworld")
```

### Problem: "Disconnected from server"

**Cause:** Server crashed or authentication failed

**Solution:**
1. Check server logs for errors
2. Verify token in localStorage: `localStorage.getItem("vaste_token")`
3. Check backend is running and accessible

### Problem: Chunks not rendering

**Cause:** Multiple possibilities
1. ChunkManager not initializing
2. Worker errors
3. Geometry creation failed

**Solution:**
1. Open browser DevTools console
2. Look for errors containing `[ChunkManager]` or `[OptimizedWorldV2]`
3. Check worker initialization:
   ```
   [NetworkV2] Chunk decoder worker initialized
   [ChunkManager] Mesh worker initialized
   ```

### Problem: Black screen instead of chunks

**Cause:** Lighting or material issue

**Solution:**
1. Check Three.js lights in GameV2.tsx
2. Verify material color is not black
3. Check camera position is not inside terrain

## Data Format Changes

### Chunk Storage

**Old Format (Column):**
- Infinite Y height
- 16x256x16 blocks
- One file per column
- Files: `chunk_0_0.dat`, `chunk_1_0.dat`, etc.

**New Format (Cubic + Regions):**
- Fixed 16x16x16 blocks
- Region files contain 32x32x32 chunks
- Files: `r.0.0.0.dat`, `r.1.0.0.dat`, etc.

**Migration:** Old world data is NOT compatible. Start with a fresh world.

### Network Protocol

**Old Format:**
- Mixed JSON and binary
- RLE compression
- Palette-based storage

**New Format:**
- Pure binary for chunks
- Simple Uint16Array encoding
- No compression (for now)

**Migration:** Client and server MUST both use v2. Mixing versions will not work.

## Configuration

### Server Config

**File:** `gameserver/server-v2.js`

**Configurable Values:**
```javascript
const renderDistanceChunks = 8;  // How many chunks to send
const autoSaveInterval = 30000;   // Auto-save every 30 seconds
```

### Client Config

**File:** `app/client/src/typesV2.ts`

**Configurable Values:**
```typescript
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  horizontalDistance: 8,  // Chunks in X/Z
  verticalDistance: 4,    // Chunks in Y
};
```

## Performance Tips

### Server
- Increase `autoSaveInterval` if saving is slow (large worlds)
- Decrease `renderDistanceChunks` for slower connections
- Use `flatworld` generator for testing (fastest)

### Client
- Decrease `DEFAULT_RENDER_CONFIG` distances for low-end GPUs
- Workers run off main thread, but mesh generation is still CPU-intensive
- Close other browser tabs to free memory

## Rollback Plan

If migration fails and you need to rollback:

1. **Stop new server:**
   ```bash
   # Ctrl+C in server terminal
   ```

2. **Revert client changes:**
   ```typescript
   // app/client/src/pages/GamePage.tsx
   import { Game } from "../Game";  // Back to old
   ```

3. **Start old server:**
   ```bash
   cd gameserver
   node server.js
   ```

4. **Restore old world data** (if backed up):
   ```bash
   cp -r world.backup/* world/
   ```

## Next Steps After Migration

Once migration is complete:

1. **Implement texture atlas** for block textures
2. **Add collision detection** so players don't fall through blocks
3. **Implement block placement/breaking** UI
4. **Add other players rendering** (multiplayer entities)
5. **Test with multiple players** in same world
6. **Implement custom generators** (biomes, caves, etc.)
7. **Add lighting system** (block light + sun light)

## Support

If you encounter issues not covered in this guide:

1. Check `WORLD_V2_README.md` for technical details
2. Review server logs for errors
3. Check browser console for client errors
4. Verify all files are in correct locations
5. Ensure Node.js version >= 16

## Summary Checklist

- [ ] Updated mod to call `CreateOrLoadWorld()`
- [ ] Updated mod to call `SetEntityInWorld()` for players
- [ ] Changed server startup to use `server-v2.js`
- [ ] Updated GamePage to import `GameV2`
- [ ] Tested connection and world assignment
- [ ] Verified chunks are loading
- [ ] Checked region files are being created
- [ ] Tested server restart persistence
- [ ] Documented any custom changes
- [ ] Backed up old world data (if needed)
