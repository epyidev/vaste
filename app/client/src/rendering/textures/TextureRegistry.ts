/**
 * Texture Registry - Central texture management system
 * Supports thousands of textures with different sizes
 */

export interface TextureEntry {
  path: string;
  width: number;
  height: number;
  atlasIndex?: number;
  atlasX?: number;
  atlasY?: number;
}

export interface BlockTextures {
  blockId: number;
  name: string;
  textures: {
    top?: string;
    bottom?: string;
    side?: string;      // NEW: Shortcut for all 4 sides
    north?: string;
    south?: string;
    east?: string;
    west?: string;
    all?: string;
  };
}

export class TextureRegistry {
  private textures = new Map<string, TextureEntry>();
  private blocks = new Map<number, BlockTextures>();
  private textureIdCounter = 0;

  registerTexture(path: string, width: number = 16, height: number = 16): string {
    if (!this.textures.has(path)) {
      this.textures.set(path, {
        path,
        width,
        height,
      });
      this.textureIdCounter++;
    }
    return path;
  }

  registerBlock(config: BlockTextures): void {
    this.blocks.set(config.blockId, config);
    
    const { textures } = config;
    if (textures.all) {
      this.registerTexture(textures.all);
    } else {
      if (textures.top) this.registerTexture(textures.top);
      if (textures.bottom) this.registerTexture(textures.bottom);
      if (textures.side) this.registerTexture(textures.side);  // NEW: Register side texture
      if (textures.north) this.registerTexture(textures.north);
      if (textures.south) this.registerTexture(textures.south);
      if (textures.east) this.registerTexture(textures.east);
      if (textures.west) this.registerTexture(textures.west);
    }
  }

  getBlockTextures(blockId: number): string[] {
    const block = this.blocks.get(blockId);
    if (!block) return ['missing', 'missing', 'missing', 'missing', 'missing', 'missing'];

    const { textures } = block;
    
    // If "all" is defined, use it for everything
    if (textures.all) {
      return [textures.all, textures.all, textures.all, textures.all, textures.all, textures.all];
    }

    // Face order: top(Y+), bottom(Y-), east(X+), west(X-), south(Z+), north(Z-)
    // "side" is a shortcut for north, south, east, west
    const sideTexture = textures.side || textures.north || textures.south || textures.east || textures.west || 'missing';
    
    return [
      textures.top || textures.all || sideTexture,
      textures.bottom || textures.all || sideTexture,
      textures.east || textures.side || sideTexture,
      textures.west || textures.side || sideTexture,
      textures.south || textures.side || sideTexture,
      textures.north || textures.side || sideTexture,
    ];
  }

  getTexture(path: string): TextureEntry | undefined {
    return this.textures.get(path);
  }

  getAllTextures(): TextureEntry[] {
    return Array.from(this.textures.values());
  }

  updateTextureAtlasPosition(path: string, atlasIndex: number, x: number, y: number): void {
    const texture = this.textures.get(path);
    if (texture) {
      texture.atlasIndex = atlasIndex;
      texture.atlasX = x;
      texture.atlasY = y;
    }
  }

  clear(): void {
    this.textures.clear();
    this.blocks.clear();
    this.textureIdCounter = 0;
  }
}

export const textureRegistry = new TextureRegistry();
