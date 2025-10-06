import * as THREE from "three";
import { getBlockName, getBlockRegistry, BlockDefinition } from "../data/BlockRegistry";

/**
 * Fallback color for missing textures - bright magenta to be obvious
 */
const FALLBACK_COLOR = 0xFF00FF; // Bright magenta/purple

/**
 * TextureAtlasManager - Loads and manages block textures from server
 * Textures are loaded from blockpack definitions received from gameserver
 */
export class TextureAtlasManager {
  private textures: Map<string, THREE.Texture> = new Map();
  private loadedBlocks = new Set<string>();

  /**
   * Load textures for a block from its registry definition
   */
  async loadBlockTextures(blockName: string): Promise<void> {
    if (this.loadedBlocks.has(blockName)) {
      return;
    }

    // Find block in registry by name
    const BLOCK_REGISTRY = getBlockRegistry();
    let blockDef = null;
    for (const [stringId, def] of BLOCK_REGISTRY) {
      if (def.name === blockName) {
        blockDef = def;
        break;
      }
    }

    if (!blockDef || !blockDef.textures) {
      console.warn(`[TextureAtlas] No block definition or textures for "${blockName}"`);
      return;
    }

    try {
      const loader = new THREE.TextureLoader();
      
      // Load "all" texture if exists
      if (blockDef.textures.all) {
        await this.loadTexture(loader, `${blockName}_all`, blockDef.textures.all);
      }
      
      // Load face-specific textures
      if (blockDef.textures.top) {
        await this.loadTexture(loader, `${blockName}_top`, blockDef.textures.top);
      }
      if (blockDef.textures.bottom) {
        await this.loadTexture(loader, `${blockName}_bottom`, blockDef.textures.bottom);
      }
      if (blockDef.textures.side) {
        await this.loadTexture(loader, `${blockName}_side`, blockDef.textures.side);
      }

      this.loadedBlocks.add(blockName);
      console.log(`[TextureAtlas] ✅ Loaded textures for "${blockName}"`);
      
    } catch (error) {
      console.error(`[TextureAtlas] ❌ Failed to load textures for "${blockName}":`, error);
    }
  }

  /**
   * Load a single texture
   */
  private async loadTexture(loader: THREE.TextureLoader, key: string, path: string): Promise<void> {
    try {
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          path,
          (tex) => resolve(tex),
          undefined,
          (error) => reject(error)
        );
      });

      // Configure texture for pixel-perfect rendering
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      this.textures.set(key, texture);
      console.log(`[TextureAtlas]   ✅ Loaded texture: ${path}`);
      
    } catch (error) {
      console.error(`[TextureAtlas]   ❌ Failed to load texture ${path}:`, error);
    }
  }

  /**
   * Get texture for a block type and face
   */
  getTexture(blockName: string, face?: "top" | "bottom" | "side"): THREE.Texture | null {
    // Try face-specific texture first
    if (face) {
      const faceTexture = this.textures.get(`${blockName}_${face}`);
      if (faceTexture) return faceTexture;
    }
    
    // Fall back to "all" texture
    const allTexture = this.textures.get(`${blockName}_all`);
    if (allTexture) return allTexture;
    
    // If no specific face requested and no "all" texture, try any available face
    if (!face) {
      // For blocks like grass that only have face-specific textures
      const topTexture = this.textures.get(`${blockName}_top`);
      if (topTexture) return topTexture; // Use top as fallback
      
      const sideTexture = this.textures.get(`${blockName}_side`);
      if (sideTexture) return sideTexture; // Use side as fallback
    }
    
    return null;
  }

  /**
   * Preload all block textures from registry
   * Should be called AFTER blockpacks are loaded from server
   */
  async preloadBlockTextures(): Promise<void> {
    // Get all blocks from registry (except air)
    const BLOCK_REGISTRY = getBlockRegistry();
    const blocksToLoad = Array.from(BLOCK_REGISTRY.values())
      .filter((block: BlockDefinition) => block.stringId !== "vaste:air")
      .map((block: BlockDefinition) => block.name);
    
    console.log("[TextureAtlas] Preloading textures for blocks:", blocksToLoad);
    
    await Promise.all(
      blocksToLoad.map(blockName => this.loadBlockTextures(blockName))
    );

    console.log(`[TextureAtlas] ✅ Loaded ${this.loadedBlocks.size} block textures`);
  }

  /**
   * Get material for a block type with texture
   * @param blockTypeOrStringId - Numeric ID (for network) or string ID (e.g., "vaste:stone")
   */
  getMaterialForBlock(blockTypeOrStringId: number | string, face?: "top" | "bottom" | "side"): THREE.Material {
    const blockName = getBlockName(blockTypeOrStringId);
    
    if (blockName === "air") {
      // Air should be transparent, no material needed
      return new THREE.MeshLambertMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.FrontSide,
      });
    }

    const texture = this.getTexture(blockName, face);

    if (texture) {
      return new THREE.MeshLambertMaterial({
        map: texture,
        side: THREE.FrontSide,
      });
    }

    // Fallback to bright magenta for ALL missing textures
    console.warn(`[TextureAtlas] No texture for "${blockName}" (id: ${blockTypeOrStringId}, face ${face || 'all'}), using magenta fallback`);
    return new THREE.MeshLambertMaterial({
      color: FALLBACK_COLOR,
      side: THREE.FrontSide,
    });
  }

  /**
   * Dispose all textures
   */
  dispose(): void {
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
    this.loadedBlocks.clear();
  }
}

// Singleton instance
export const textureAtlas = new TextureAtlasManager();

