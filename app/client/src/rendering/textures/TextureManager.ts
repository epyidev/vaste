/**
 * Texture Manager - Main facade for texture system
 */

import * as THREE from 'three';
import { TextureRegistry, textureRegistry } from './TextureRegistry';
import { TextureLoader, textureLoader } from './TextureLoader';
import { TextureAtlasBuilder } from './TextureAtlasBuilder';

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

    this.registerDefaultBlocks();

    this.atlasBuilder = new TextureAtlasBuilder(this.registry, this.loader, 2048);
    await this.atlasBuilder.build();

    this.initialized = true;
    console.log('[TextureManager] Initialization complete');
  }

  private registerDefaultBlocks(): void {
    console.log('[TextureManager] Registering default blocks...');
    
    this.registry.registerBlock({
      blockId: 1,
      name: 'stone',
      textures: {
        all: '/blockpacks/stone/textures/stone.png'
      }
    });

    this.registry.registerBlock({
      blockId: 2,
      name: 'dirt',
      textures: {
        all: '/blockpacks/dirt/textures/dirt.png'
      }
    });

    this.registry.registerBlock({
      blockId: 3,
      name: 'grass',
      textures: {
        top: '/blockpacks/grass/textures/grass_top.png',
        bottom: '/blockpacks/dirt/textures/dirt.png',
        north: '/blockpacks/grass/textures/grass_side.png',
        south: '/blockpacks/grass/textures/grass_side.png',
        east: '/blockpacks/grass/textures/grass_side.png',
        west: '/blockpacks/grass/textures/grass_side.png',
      }
    });

    this.registry.registerBlock({
      blockId: 4,
      name: 'wood',
      textures: {
        all: '/blockpacks/wood/textures/wood.png'
      }
    });

    this.registry.registerBlock({
      blockId: 5,
      name: 'sand',
      textures: {
        all: '/blockpacks/sand/textures/sand.png'
      }
    });

    const allTextures = this.registry.getAllTextures();
    console.log(`[TextureManager] Registered 5 blocks with ${allTextures.length} unique textures`);
    allTextures.forEach(tex => {
      console.log(`  - ${tex.path} (${tex.width}x${tex.height})`);
    });
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

    const facePaths = this.registry.getBlockTextures(blockId);
    const texturePath = facePaths[faceIndex];

    if (!this.hasLoggedGetUVs) {
      console.log(`[TextureManager] getUVs called: blockId=${blockId}, faceIndex=${faceIndex}, path=${texturePath}`);
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
