/**
 * WorldManager.js - World management for vaste-api (Lua bindings)
 * Manages world instances created by mods
 */

const path = require('path');
const { World } = require('../../world');

class WorldManager {
    constructor() {
        // Map of world ID -> World instance
        this.worlds = new Map();
        
        // Currently active world (used for player spawning)
        this.activeWorld = null;
        
        // Map of world ID -> world metadata
        this.worldMetadata = new Map();
    }

    /**
     * Create or load a world
     * @param {string} worldPath - Relative or absolute path to world directory
     * @param {Object} options - World options
     * @param {string} options.type - Generator type (default: 'flatworld')
     * @param {Object} options.generatorOptions - Generator-specific options
     * @returns {World} World instance
     */
    createOrLoadWorld(worldPath, options = {}) {
        const generatorType = options.type || 'flatworld';
        const generatorOptions = options.generatorOptions || {};
        
        // Resolve absolute path
        const absPath = path.isAbsolute(worldPath) ? worldPath : path.resolve(worldPath);
        
        // Check if world already loaded
        let world = this.worlds.get(absPath);
        if (world) {
            console.log(`[WorldManager] World already loaded: ${absPath}`);
            return world;
        }
        
        // Create new world instance
        try {
            world = new World(absPath, generatorType, generatorOptions);
            this.worlds.set(absPath, world);
            
            // Store metadata
            this.worldMetadata.set(absPath, {
                path: absPath,
                generatorType,
                generatorOptions,
                createdAt: Date.now()
            });
            
            // Set as active world if no active world
            if (!this.activeWorld) {
                this.activeWorld = world;
                console.log(`[WorldManager] Set ${absPath} as active world`);
            }
            
            console.log(`[WorldManager] Created/loaded world: ${absPath} (generator: ${generatorType})`);
            return world;
            
        } catch (error) {
            console.error(`[WorldManager] Error creating/loading world ${absPath}:`, error);
            throw error;
        }
    }

    /**
     * Get a world by path
     * @param {string} worldPath - World path
     * @returns {World|null}
     */
    getWorld(worldPath) {
        const absPath = path.isAbsolute(worldPath) ? worldPath : path.resolve(worldPath);
        return this.worlds.get(absPath) || null;
    }

    /**
     * Get the active world
     * @returns {World|null}
     */
    getActiveWorld() {
        return this.activeWorld;
    }

    /**
     * Set the active world
     * @param {World} world - World instance
     */
    setActiveWorld(world) {
        if (!world) {
            this.activeWorld = null;
            return;
        }
        
        // Ensure the world is managed by this manager
        let found = false;
        for (const w of this.worlds.values()) {
            if (w === world) {
                found = true;
                break;
            }
        }
        
        if (!found) {
            console.warn('[WorldManager] Attempting to set active world that is not managed');
            return;
        }
        
        this.activeWorld = world;
        console.log(`[WorldManager] Active world set to: ${world.worldPath}`);
    }

    /**
     * Fill blocks in a world (utility for mods)
     * @param {World} world - World instance
     * @param {Object} startPos - Start position {x, y, z}
     * @param {Object} endPos - End position {x, y, z}
     * @param {number} blockType - Block type ID
     */
    fillBlocksInWorld(world, startPos, endPos, blockType = 1) {
        if (!world || typeof world.setBlock !== 'function') {
            throw new Error('Invalid world object');
        }
        
        const minX = Math.min(startPos.x, endPos.x);
        const maxX = Math.max(startPos.x, endPos.x);
        const minY = Math.min(startPos.y, endPos.y);
        const maxY = Math.max(startPos.y, endPos.y);
        const minZ = Math.min(startPos.z, endPos.z);
        const maxZ = Math.max(startPos.z, endPos.z);
        
        let count = 0;
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    world.setBlock(x, y, z, blockType);
                    count++;
                }
            }
        }
        
        console.log(`[WorldManager] Filled ${count} blocks in world`);
    }

    /**
     * Destroy a world
     * @param {string} worldPath - World path
     * @returns {boolean} Success
     */
    destroyWorld(worldPath) {
        const absPath = path.isAbsolute(worldPath) ? worldPath : path.resolve(worldPath);
        const world = this.worlds.get(absPath);
        
        if (!world) {
            return false;
        }
        
        // Cleanup world
        world.destroy();
        
        // Remove from maps
        this.worlds.delete(absPath);
        this.worldMetadata.delete(absPath);
        
        // Clear active world if it was this one
        if (this.activeWorld === world) {
            this.activeWorld = null;
            console.log('[WorldManager] Active world destroyed, no active world now');
        }
        
        console.log(`[WorldManager] Destroyed world: ${absPath}`);
        return true;
    }

    /**
     * Save all worlds
     */
    saveAll() {
        console.log('[WorldManager] Saving all worlds...');
        for (const world of this.worlds.values()) {
            world.saveAll();
        }
    }

    /**
     * Cleanup all worlds (on server shutdown)
     */
    cleanup() {
        console.log('[WorldManager] Cleaning up all worlds...');
        
        for (const world of this.worlds.values()) {
            world.destroy();
        }
        
        this.worlds.clear();
        this.worldMetadata.clear();
        this.activeWorld = null;
    }
}

module.exports = { WorldManager };
