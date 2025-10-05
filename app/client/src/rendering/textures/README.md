# Professional Texture System

A scalable texture management system designed to handle thousands of textures with varying sizes efficiently.

## Architecture

### Core Components

1. **TextureRegistry** - Central registry for all textures
   - Tracks texture metadata (path, size, atlas position)
   - Maps block IDs to their textures (top, bottom, sides)
   - Singleton pattern for global access

2. **TextureLoader** - Asynchronous texture loading
   - Image caching to avoid duplicate loads
   - Promise-based loading with retry logic
   - Automatic fallback for missing textures

3. **TextureAtlasBuilder** - Dynamic atlas generation
   - Bin-packing algorithm for optimal space usage
   - Supports textures of different sizes
   - Configurable atlas size (default: 2048x2048)
   - 1px padding to prevent texture bleeding

4. **TextureManager** - Main facade
   - Single entry point for texture operations
   - Handles initialization and block registration
   - Provides UV coordinate calculation

## Usage

### Basic Initialization

```typescript
import { textureManager } from './rendering/textures/TextureManager';

// Initialize texture system (call once at app start)
await textureManager.initialize();

// Get atlas texture for material
const atlasTexture = textureManager.getTexture();

// Get UV coords for a specific block face
const [u0, v0, u1, v1] = textureManager.getUVs(blockId, faceIndex);
```

### Registering New Blocks

```typescript
import { textureRegistry } from './rendering/textures/TextureRegistry';

// Block with same texture on all faces
textureRegistry.registerBlock({
  blockId: 10,
  name: 'custom_stone',
  textures: {
    all: '/textures/custom_stone.png'
  }
});

// Block with different textures per face
textureRegistry.registerBlock({
  blockId: 11,
  name: 'custom_grass',
  textures: {
    top: '/textures/grass_top.png',
    bottom: '/textures/dirt.png',
    north: '/textures/grass_side.png',
    south: '/textures/grass_side.png',
    east: '/textures/grass_side.png',
    west: '/textures/grass_side.png',
  }
});
```

### Face Index Mapping

```typescript
// Face indices for getUVs(blockId, faceIndex)
0 - Top    (Y+)
1 - Bottom (Y-)
2 - North  (Z+)
3 - South  (Z-)
4 - East   (X+)
5 - West   (X-)
```

## Features

### Scalability
- Supports thousands of textures
- Dynamic atlas generation
- Efficient bin-packing algorithm
- Memory-efficient caching

### Flexibility
- Variable texture sizes (16x16, 32x32, 64x64, etc.)
- Per-face texture mapping
- Hot-reload support (re-initialize to reload)

### Performance
- Single atlas texture (1 draw call)
- Nearest-neighbor filtering for pixel-perfect rendering
- Lazy loading with caching
- Automatic texture deduplication

### Robustness
- Fallback textures for missing images
- Error handling and logging
- Cross-origin image support

## Technical Details

### Bin Packing Algorithm
The atlas builder uses a recursive bin-packing algorithm:
1. Sort textures by size (largest first)
2. For each texture, find smallest free space
3. Split remaining space into right and down nodes
4. Continue until all textures are packed

### UV Coordinate Calculation
```typescript
u0 = atlasX / atlasSize
v0 = atlasY / atlasSize
u1 = (atlasX + textureWidth) / atlasSize
v1 = (atlasY + textureHeight) / atlasSize
```

### Memory Considerations
- Default atlas: 2048x2048 (16MB RGBA)
- Increase atlas size for more textures
- Consider texture compression for production

## Future Enhancements

- [ ] Multiple atlas support (for >2048² textures)
- [ ] Mipmap generation
- [ ] Texture compression (DXT, ETC2)
- [ ] WebP support
- [ ] Animated textures
- [ ] Normal map support
- [ ] Runtime texture addition
