# Quick Start - Vaste World System v2

🚀 **World System v2 is now active!** Follow these steps to start the server and client.

## Prerequisites

- Node.js >= 16
- npm or yarn
- MySQL database (for backend API)

## 1. Start Backend API (if not running)

```bash
cd app
npm install
npm run dev
```

The backend should run on `http://localhost:3000`

## 2. Start Game Server v2

```bash
cd gameserver
npm install
npm start
```

**Expected output:**
```
Test mod server script loaded
Test world created or loaded at 'savedworld/testworld'
[INFO] Game server listening on port 8080
```

**Important:** The server now uses `server-v2.js` (configured in package.json)

## 3. Start Client

Open a new terminal:

```bash
cd app
npm install
npm run dev
```

The client should open at `http://localhost:5173`

## 4. Connect to Server

1. Register/Login at `http://localhost:5173/login`
2. Go to "My Servers" or "Server List"
3. Click "Play" on a server
4. Wait for "World assigned" message
5. You should spawn in the flatworld at coordinates (0, 50, 0)

## Expected Flow

### Server Console
```
Test mod server script loaded
Test world created or loaded at 'savedworld/testworld'
[INFO] Game server listening on port 8080
[INFO] Client connected
[INFO] Player authenticated: [username]
[INFO] Player [username] joined and placed in test world
[INFO] Player [username] positioned at (0, 50, 0)
```

### Client Console (Browser DevTools)
```
[NetworkV2] Connected to server
[NetworkV2] World assigned: flatworld
[NetworkV2] Spawn point: (0, 50, 0)
[ChunkManager] Mesh worker initialized
[NetworkV2] Received chunk (0, 3, 0) with X blocks
[OptimizedWorldV2] Chunks: X, Meshes: X, Queue: 0
```

### Client UI
- Loading screen: "Connecting to server..."
- Loading screen: "Waiting for world assignment..."
- Game renders with player at spawn point
- HUD shows position, chunk count, players
- Controls: WASD (move), Space (jump), Mouse (look)

## Troubleshooting

### Server won't start
**Error:** `Cannot find module './server-v2.js'`
- **Fix:** Ensure you're in `gameserver/` directory
- **Check:** `package.json` main should be `"server-v2.js"`

### "Waiting for world assignment..." forever
**Cause:** Mod didn't create world
- **Check:** Server console should show "Test world created or loaded"
- **Fix:** Verify `gameserver/mods/test/server/main.lua` exists and has `CreateOrLoadWorld()`

### Client errors about missing modules
**Error:** `Cannot find module './GameV2'`
- **Fix:** Ensure you're in `app/` directory
- **Check:** `app/client/src/GameV2.tsx` exists

### Black screen / no chunks
**Check:**
1. Browser console for errors
2. Network tab: WebSocket connected?
3. Console should show "Received chunk" messages
4. Check ChunkManager initialized

### Players fall through blocks
**Status:** Normal - collision detection not yet implemented
**Workaround:** Use creative flying mode (not implemented yet)

## File Locations

**Server:**
- Main: `gameserver/server-v2.js`
- World System: `gameserver/world-v2/`
- Mod: `gameserver/mods/test/server/main.lua`
- World Data: `gameserver/mods/test/savedworld/testworld/`

**Client:**
- Main: `app/client/src/GameV2.tsx`
- Network: `app/client/src/networkV2.ts`
- Rendering: `app/client/src/components/OptimizedWorldV2.tsx`

**Archived (v1):**
- Server: `gameserver/archive/`
- Client: `app/client/src/archive/`

## Configuration

### Server

Edit `gameserver/server-v2.js`:
```javascript
const renderDistanceChunks = 8;  // Chunks to send to clients
const autoSaveInterval = 30000;   // Auto-save every 30s
```

### Client

Edit `app/client/src/typesV2.ts`:
```typescript
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  horizontalDistance: 8,  // Chunks in X/Z
  verticalDistance: 4,    // Chunks in Y
};
```

### Mod

Edit `gameserver/mods/test/server/main.lua`:
```lua
-- Change world path
local testworld = CreateOrLoadWorld("savedworld/myworld", "flatworld")

-- Change spawn position
SetEntityCoords(playerEntity, vec3(0, 100, 0))
```

## Testing Checklist

- [ ] Backend API running on port 3000
- [ ] Game server running on port 8080
- [ ] Client running on port 5173
- [ ] Can register/login
- [ ] Can connect to server
- [ ] World assignment message received
- [ ] Player spawns at (0, 50, 0)
- [ ] Chunks render around player
- [ ] Can move with WASD
- [ ] Can jump with Space
- [ ] Can look around with mouse
- [ ] HUD shows position and chunks

## Next Steps

Once basic functionality is confirmed:

1. **Implement Collision Detection**
   - Add bounding box collision
   - Prevent falling through blocks

2. **Add Texture Atlas**
   - Create block texture atlas
   - Update OptimizedWorldV2 to use textures

3. **Connect Block Placement**
   - Add raycasting for block targeting
   - Connect to block place/break messages

4. **Render Other Players**
   - Add entity rendering system
   - Show other players in world

5. **Add Lighting**
   - Implement block light propagation
   - Add sun/shadow system

## Documentation

- **Technical Details:** `/WORLD_V2_README.md`
- **Migration Guide:** `/MIGRATION_GUIDE.md`
- **Implementation Summary:** `/IMPLEMENTATION_SUMMARY.md`
- **Migration Status:** `/MIGRATION_STATUS.md`
- **Archive Info:** `/gameserver/archive/README.md`

## Support

If you encounter issues:
1. Check server console logs
2. Check browser DevTools console
3. Review documentation files
4. Check archived files in `gameserver/archive/` and `app/client/src/archive/`

## Rollback

If you need to revert to v1:
```bash
# See MIGRATION_STATUS.md "Rollback Plan" section
```

---

**System Version:** 2.0.0  
**Migration Date:** October 5, 2025  
**Status:** ✅ Ready for testing
