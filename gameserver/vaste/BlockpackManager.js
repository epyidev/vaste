/**
 * BlockpackManager.js - Server-side blockpack management
 * Scans, validates, and serves blockpacks to connected clients
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { log, warn, error } = require('./Logger');

class BlockpackManager {
  constructor(blockpacksDir) {
    this.blockpacksDir = blockpacksDir;
    this.blockpacks = new Map(); // Map<blockName, blockDefinition>
    this.blockpacksList = []; // Array of blockpack names
    this.initialized = false;
  }

  /**
   * Initialize blockpack manager - scan and load all blockpacks
   */
  async initialize() {

    if (!fsSync.existsSync(this.blockpacksDir)) {
      error(`Blockpacks directory not found: ${this.blockpacksDir}`);
      throw new Error('Blockpacks directory not found');
    }

    try {
      const entries = await fs.readdir(this.blockpacksDir, { withFileTypes: true });
      
      // Filter only directories
      const blockpackDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      log(`Found ${blockpackDirs.length} potential blockpacks`);

      let loadedCount = 0;

      for (const blockName of blockpackDirs) {
        try {
          const blockJsonPath = path.join(this.blockpacksDir, blockName, 'block.json');
          
          // Check if block.json exists
          if (!fsSync.existsSync(blockJsonPath)) {
            warn(`Skipping ${blockName}: no block.json found`);
            continue;
          }

          // Load and parse block.json
          const blockJsonContent = await fs.readFile(blockJsonPath, 'utf-8');
          const blockData = JSON.parse(blockJsonContent);

          // Validate required fields
          if (!blockData.stringId || !blockData.name || !blockData.displayName) {
            error(`Invalid block.json in ${blockName}: missing required fields (stringId, name, displayName)`);
            continue;
          }

          // Store blockpack data
          this.blockpacks.set(blockName, blockData);
          this.blockpacksList.push(blockName);
          loadedCount++;

          log(`✓ Loaded ${blockData.stringId} (${blockData.displayName})`);
        } catch (err) {
          error(`Error loading blockpack ${blockName}: ${err.message}`);
        }
      }

      this.initialized = true;
      log(`Successfully loaded ${loadedCount}/${blockpackDirs.length} blockpacks`);

      return {
        total: blockpackDirs.length,
        loaded: loadedCount,
        blockpacks: this.blockpacksList
      };
    } catch (err) {
      error(`Initialization error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get list of all blockpack names
   */
  getBlockpacksList() {
    return this.blockpacksList;
  }

  /**
   * Get block.json content for a specific blockpack
   */
  async getBlockJson(blockName) {
    const blockJsonPath = path.join(this.blockpacksDir, blockName, 'block.json');
    
    if (!fsSync.existsSync(blockJsonPath)) {
      throw new Error(`Blockpack ${blockName} not found`);
    }

    const content = await fs.readFile(blockJsonPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Get texture file for a specific blockpack
   */
  async getTexture(blockName, texturePath) {
    // Security: prevent directory traversal
    const safePath = path.normalize(texturePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(this.blockpacksDir, blockName, 'textures', safePath);

    if (!fsSync.existsSync(fullPath)) {
      throw new Error(`Texture not found: ${texturePath} in blockpack ${blockName}`);
    }

    return await fs.readFile(fullPath);
  }

  /**
   * Get all blockpack definitions (for client synchronization)
   */
  getAllBlockDefinitions() {
    const definitions = [];
    for (const [blockName, blockData] of this.blockpacks) {
      definitions.push(blockData);
    }
    return definitions;
  }

  /**
   * Check if manager is initialized
   */
  isInitialized() {
    return this.initialized;
  }
}

module.exports = { BlockpackManager };
