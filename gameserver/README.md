# Vaste Game Server

A voxel-based multiplayer game server with mod support.

## Quick Start

**Windows:**
```bash
start.bat
```

**Linux / Mac:**
```bash
chmod +x start.sh
./start.sh
```

## Requirements

- Node.js 16 or higher

## Configuration

Edit `server-config.json`:

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

## Directory Structure

- `vaste/` - Server core files
- `mods/` - Custom mods
- `server-config.json` - Server configuration

## Notes

Dependencies are installed automatically on first launch.
