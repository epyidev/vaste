/**
 * World.js - Main world manager
 * Manages regions, chunks, generation, and storage
 */

const { Chunk, CHUNK_SIZE } = require('./Chunk');
const { Region, REGION_SIZE } = require('./Region');
const { WorldStorage } = require('./WorldStorage');
const { registry } = require('./GeneratorRegistry');
const { log } = require('../Logger');

class World {
    /**
     * Create a new world
     * @param {string} worldPath - Path where world data is stored
     * @param {string} generatorType - Generator type name
     * @param {Object} generatorOptions - Generator options
     */
    constructor(worldPath, generatorType = 'flatworld', generatorOptions = {}) {
        this.worldPath = worldPath;
        this.generatorType = generatorType;
        this.generatorOptions = generatorOptions;
        
        // Create generator
        this.generator = registry.create(generatorType, generatorOptions);
        
        // Storage manager
        this.storage = new WorldStorage(worldPath);
        
        // Loaded regions (sparse storage)
        // Key format: "rx,ry,rz"
        this.regions = new Map();
        
        // Spawn point
        this.spawnPoint = this.generator.getSpawnPoint ? this.generator.getSpawnPoint() : { x: 0, y: 64, z: 0 };
        
        // World metadata
        this.metadata = {
            generatorType,
            generatorOptions,
            spawnPoint: this.spawnPoint,
            created: Date.now(),
            lastAccessed: Date.now()
        };
        
        // Load or save initial metadata
        const loadedMeta = this.storage.loadMetadata();
        if (loadedMeta) {
            this.metadata = loadedMeta;
            this.spawnPoint = loadedMeta.spawnPoint || this.spawnPoint;
        } else {
            this.storage.saveMetadata(this.metadata);
        }
        
        // Auto-save interval (every 30 seconds)
        this.autoSaveInterval = setInterval(() => this.saveAll(), 30000);
    }

    /**
     * Convert world coordinates to region coordinates
     * @param {number} cx - Chunk X
     * @param {number} cy - Chunk Y
     * @param {number} cz - Chunk Z
     * @returns {{rx: number, ry: number, rz: number, localCx: number, localCy: number, localCz: number}}
     */
    static chunkToRegion(cx, cy, cz) {
        const rx = Math.floor(cx / REGION_SIZE);
        const ry = Math.floor(cy / REGION_SIZE);
        const rz = Math.floor(cz / REGION_SIZE);
        
        const localCx = ((cx % REGION_SIZE) + REGION_SIZE) % REGION_SIZE;
        const localCy = ((cy % REGION_SIZE) + REGION_SIZE) % REGION_SIZE;
        const localCz = ((cz % REGION_SIZE) + REGION_SIZE) % REGION_SIZE;
        
        return { rx, ry, rz, localCx, localCy, localCz };
    }

    /**
     * Convert world coordinates to chunk coordinates
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {number} z - World Z
     * @returns {{cx: number, cy: number, cz: number, localX: number, localY: number, localZ: number}}
     */
    static worldToChunk(x, y, z) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        
        const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        
        return { cx, cy, cz, localX, localY, localZ };
    }

    /**
     * Get region key
     * @param {number} rx - Region X
     * @param {number} ry - Region Y
     * @param {number} rz - Region Z
     * @returns {string}
     */
    static getRegionKey(rx, ry, rz) {
        return `${rx},${ry},${rz}`;
    }

    /**
     * Get or load a region
     * @param {number} rx - Region X
     * @param {number} ry - Region Y
     * @param {number} rz - Region Z
     * @returns {Region}
     */
    getOrLoadRegion(rx, ry, rz) {
        const key = World.getRegionKey(rx, ry, rz);
        let region = this.regions.get(key);
        
        if (!region) {
            // Try to load from disk
            region = this.storage.loadRegion(rx, ry, rz);
            
            if (!region) {
                // Create new empty region
                region = new Region(rx, ry, rz);
            }
            
            this.regions.set(key, region);
        }
        
        return region;
    }

    /**
     * Get or generate a chunk
     * @param {number} cx - Chunk X
     * @param {number} cy - Chunk Y
     * @param {number} cz - Chunk Z
     * @returns {Chunk}
     */
    getOrGenerateChunk(cx, cy, cz) {
        const { rx, ry, rz, localCx, localCy, localCz } = World.chunkToRegion(cx, cy, cz);
        const region = this.getOrLoadRegion(rx, ry, rz);
        
        let chunk = region.getChunk(localCx, localCy, localCz);
        
        if (!chunk) {
            // Generate new chunk
            chunk = this.generator.generateChunk(cx, cy, cz);
            region.setChunk(localCx, localCy, localCz, chunk);
        }
        
        return chunk;
    }

    /**
     * Get a chunk (no generation)
     * @param {number} cx - Chunk X
     * @param {number} cy - Chunk Y
     * @param {number} cz - Chunk Z
     * @returns {Chunk|null}
     */
    getChunk(cx, cy, cz) {
        const { rx, ry, rz, localCx, localCy, localCz } = World.chunkToRegion(cx, cy, cz);
        const key = World.getRegionKey(rx, ry, rz);
        const region = this.regions.get(key);
        
        if (!region) {
            return null;
        }
        
        return region.getChunk(localCx, localCy, localCz);
    }

    /**
     * Set block at world coordinates
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {number} z - World Z
     * @param {number} blockType - Block type ID
     */
    setBlock(x, y, z, blockType) {
        const { cx, cy, cz, localX, localY, localZ } = World.worldToChunk(x, y, z);
        const chunk = this.getOrGenerateChunk(cx, cy, cz);
        chunk.setBlock(localX, localY, localZ, blockType);
        
        // Mark region as dirty
        const { rx, ry, rz } = World.chunkToRegion(cx, cy, cz);
        const region = this.getOrLoadRegion(rx, ry, rz);
        region.dirty = true;
    }

    /**
     * Get block at world coordinates
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {number} z - World Z
     * @returns {number} Block type ID (0 = air)
     */
    getBlock(x, y, z) {
        const { cx, cy, cz, localX, localY, localZ } = World.worldToChunk(x, y, z);
        const chunk = this.getChunk(cx, cy, cz);
        
        if (!chunk) {
            return 0; // Air
        }
        
        return chunk.getBlock(localX, localY, localZ);
    }

    /**
     * Get chunks in range (for sending to player)
     * @param {number} centerX - Center world X
     * @param {number} centerY - Center world Y
     * @param {number} centerZ - Center world Z
     * @param {number} radiusChunks - Radius in chunks
     * @returns {Chunk[]}
     */
    getChunksInRange(centerX, centerY, centerZ, radiusChunks) {
        const { cx: centerCx, cy: centerCy, cz: centerCz } = World.worldToChunk(centerX, centerY, centerZ);
        
        const chunks = [];
        const minCx = centerCx - radiusChunks;
        const maxCx = centerCx + radiusChunks;
        const minCy = centerCy - radiusChunks;
        const maxCy = centerCy + radiusChunks;
        const minCz = centerCz - radiusChunks;
        const maxCz = centerCz + radiusChunks;
        
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                for (let cz = minCz; cz <= maxCz; cz++) {
                    const chunk = this.getOrGenerateChunk(cx, cy, cz);
                    if (chunk && !chunk.isEmpty()) {
                        chunks.push(chunk);
                    }
                }
            }
        }
        
        return chunks;
    }

    /**
     * Save all dirty regions
     */
    saveAll() {
        let savedCount = 0;
        
        for (const region of this.regions.values()) {
            if (region.dirty) {
                this.storage.saveRegion(region);
                savedCount++;
            }
        }
        
        if (savedCount > 0) {
            log(`[World] Saved ${savedCount} dirty regions`);
        }
        
        // Update last accessed time
        this.metadata.lastAccessed = Date.now();
        this.storage.saveMetadata(this.metadata);
    }

    /**
     * Cleanup and shutdown
     */
    destroy() {
        // Clear auto-save interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Save all regions
        this.saveAll();
        
        // Clear loaded regions
        this.regions.clear();
        
        log(`[World] World destroyed: ${this.worldPath}`);
    }
}

module.exports = { World };
