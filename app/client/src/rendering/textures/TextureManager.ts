/**
 * Texture Manager - Main facade for texture system
 * Loads textures from server-side blockpack definitions
 */

import * as THREE from 'three';
import { TextureRegistry, textureRegistry } from './TextureRegistry';
import { TextureLoader, textureLoader } from './TextureLoader';
import { TextureAtlasBuilder } from './TextureAtlasBuilder';
import { getBlockRegistry, BlockDefinition, blockMapping } from '../../data/BlockRegistry';

export class TextureManager {
  private registry: TextureRegistry;
  private loader: TextureLoader;
  private atlasBuilder: TextureAtlasBuilder | null = null;
  private initialized = false;

  constructor() {
    this.registry = textureRegistry;
    this.loader = textureLoader;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[TextureManager] Already initialized');
      return;
    }

    console.log('[TextureManager] Initializing...');

    // Register blocks from BlockRegistry (loaded from server)
    this.registerBlocksFromRegistry();

    this.atlasBuilder = new TextureAtlasBuilder(this.registry, this.loader, 2048);
    await this.atlasBuilder.build();

    this.initialized = true;
    console.log('[TextureManager] Initialization complete');
  }

  /**
   * Register blocks from BlockRegistry (server-side blockpacks)
   */
  private registerBlocksFromRegistry(): void {
    console.log('[TextureManager] Registering blocks from server blockpacks...');
    
    const BLOCK_REGISTRY = getBlockRegistry();
    let registeredCount = 0;

    for (const [stringId, blockDef] of BLOCK_REGISTRY) {
      // Skip air (no textures)
      if (blockDef.stringId === 'vaste:air') continue;

      // Extract numeric ID from mapping (for compatibility with old system)
      // For now, use a simple hash or counter
      const blockId = this.getBlockIdFromStringId(stringId);

      if (blockDef.textures) {
        this.registry.registerBlock({
          blockId: blockId,
          name: blockDef.name,
          textures: blockDef.textures
        });
        registeredCount++;
      }
    }

    const allTextures = this.registry.getAllTextures();
    console.log(`[TextureManager] Registered ${registeredCount} blocks with ${allTextures.length} unique textures from server`);
  }

  /**
   * Simple hash function to get numeric ID from string ID
   * This is temporary - ideally should use blockMapping
   */
  private getBlockIdFromStringId(stringId: string): number {
    // Simple hash for now
    let hash = 0;
    for (let i = 0; i < stringId.length; i++) {
      const char = stringId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 10000; // Keep it reasonable
  }

  getTexture(): THREE.Texture | null {
    if (!this.atlasBuilder) {
      console.error('[TextureManager] Not initialized');
      return null;
    }
    return this.atlasBuilder.getTexture();
  }

  getUVs(blockId: number, faceIndex: number): [number, number, number, number] {
    if (!this.atlasBuilder) {
      console.error('[TextureManager] Not initialized - cannot get UVs');
      return [0, 0, 1, 1];
    }

    // Convert numeric ID to string ID using blockMapping
    const stringId = blockMapping.getStringId(blockId);
    
    // Convert string ID to hash ID (same as registration)
    const hashId = this.getBlockIdFromStringId(stringId);
    
    const facePaths = this.registry.getBlockTextures(hashId);
    const texturePath = facePaths[faceIndex];

    if (!this.hasLoggedGetUVs) {
      console.log(`[TextureManager] getUVs called: numericId=${blockId}, stringId=${stringId}, hashId=${hashId}, faceIndex=${faceIndex}, path=${texturePath}`);
      this.hasLoggedGetUVs = true;
    }

    const uvs = this.atlasBuilder.getUVs(texturePath);
    
    return uvs;
  }

  private hasLoggedGetUVs = false;

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const textureManager = new TextureManager();
