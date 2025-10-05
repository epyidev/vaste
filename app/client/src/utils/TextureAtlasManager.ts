import * as THREE from "three";
import { getBlockName, BLOCK_REGISTRY, blockMapping } from "../data/BlockRegistry";

/**
 * Fallback color for missing textures - bright magenta to be obvious
 */
const FALLBACK_COLOR = 0xFF00FF; // Bright magenta/purple

interface BlockConfig {
  id?: number; // Deprecated - not used anymore
  name: string;
  textures: {
    all?: string;
    top?: string;
    bottom?: string;
    side?: string;
  };
}

/**
 * TextureAtlasManager - Loads and manages block textures from blockpacks
 */
export class TextureAtlasManager {
  private textures: Map<string, THREE.Texture> = new Map();
  private blockConfigs: Map<string, BlockConfig> = new Map();
  private loadedBlockpacks = new Set<string>();

  /**
   * Load a blockpack configuration and textures
   */
  async loadBlockpack(blockName: string): Promise<void> {
    if (this.loadedBlockpacks.has(blockName)) {
      return;
    }

    try {
      // Load block.json
      const configPath = `/blockpacks/${blockName}/block.json`;
      console.log(`[TextureAtlas] Loading config: ${configPath}`);
      
      const response = await fetch(configPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const config: BlockConfig = await response.json();
      this.blockConfigs.set(blockName, config);
      
      console.log(`[TextureAtlas] ✅ Config loaded for "${blockName}":`, config.textures);

      // Load textures
      const loader = new THREE.TextureLoader();
      
      // Load "all" texture if exists
      if (config.textures.all) {
        await this.loadTexture(loader, `${blockName}_all`, config.textures.all);
      }
      
      // Load face-specific textures
      if (config.textures.top) {
        await this.loadTexture(loader, `${blockName}_top`, config.textures.top);
      }
      if (config.textures.bottom) {
        await this.loadTexture(loader, `${blockName}_bottom`, config.textures.bottom);
      }
      if (config.textures.side) {
        await this.loadTexture(loader, `${blockName}_side`, config.textures.side);
      }

      this.loadedBlockpacks.add(blockName);
      console.log(`[TextureAtlas] ✅ Blockpack "${blockName}" fully loaded`);
      
    } catch (error) {
      console.error(`[TextureAtlas] ❌ Failed to load blockpack "${blockName}":`, error);
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
   * Preload common blockpacks
   */
  async preloadBlockpacks(): Promise<void> {
    // Get all blocks from registry (except air)
    const blocksToLoad = Array.from(BLOCK_REGISTRY.values())
      .filter(block => block.stringId !== "vaste:air")
      .map(block => block.name);
    
    console.log("[TextureAtlas] Preloading blockpacks:", blocksToLoad);
    
    await Promise.all(
      blocksToLoad.map(blockName => this.loadBlockpack(blockName))
    );

    console.log(`[TextureAtlas] ✅ Loaded ${this.loadedBlockpacks.size} blockpacks`);
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
    this.loadedBlockpacks.clear();
  }
}

// Singleton instance
export const textureAtlas = new TextureAtlasManager();
