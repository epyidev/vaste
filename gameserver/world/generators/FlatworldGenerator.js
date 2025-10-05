/**
 * FlatworldGenerator.js - Simple flat world generator
 * Generates a flat terrain with configurable layers
 */

const { Chunk, CHUNK_SIZE } = require('../Chunk');

class FlatworldGenerator {
    /**
     * Create a flatworld generator
     * @param {Object} options - Generation options
     * @param {number} options.grassLayers - Number of grass layers (default: 1)
     * @param {number} options.dirtLayers - Number of dirt layers (default: 3)
     * @param {number} options.stoneLayers - Number of stone layers (default: 40)
     */
    constructor(options = {}) {
        this.grassLayers = options.grassLayers || 1;
        this.dirtLayers = options.dirtLayers || 3;
        this.stoneLayers = options.stoneLayers || 40;
        
        // Calculate total height of solid ground
        this.groundHeight = this.grassLayers + this.dirtLayers + this.stoneLayers;
        
        console.log(`[FlatworldGenerator] Created with ${this.groundHeight} blocks of terrain`);
    }

    /**
     * Generate a chunk
     * @param {number} cx - Chunk X coordinate
     * @param {number} cy - Chunk Y coordinate
     * @param {number} cz - Chunk Z coordinate
     * @returns {Chunk}
     */
    generateChunk(cx, cy, cz) {
        const chunk = new Chunk(cx, cy, cz);
        
        // Calculate world Y range for this chunk
        const baseY = cy * CHUNK_SIZE;
        const topY = baseY + CHUNK_SIZE - 1;
        
        // Only generate if chunk intersects with ground
        if (topY < 0 || baseY >= this.groundHeight) {
            // Chunk is entirely above or below ground - return empty chunk
            return chunk;
        }
        
        // Generate terrain for each column in the chunk
        for (let localX = 0; localX < CHUNK_SIZE; localX++) {
            for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
                for (let localY = 0; localY < CHUNK_SIZE; localY++) {
                    const worldY = baseY + localY;
                    
                    // Skip if above ground
                    if (worldY >= this.groundHeight) {
                        continue;
                    }
                    
                    // Determine block type based on depth from top
                    const depthFromTop = this.groundHeight - 1 - worldY;
                    let blockType;
                    
                    if (depthFromTop < this.grassLayers) {
                        blockType = 3; // Grass
                    } else if (depthFromTop < this.grassLayers + this.dirtLayers) {
                        blockType = 2; // Dirt
                    } else {
                        blockType = 1; // Stone
                    }
                    
                    chunk.setBlock(localX, localY, localZ, blockType);
                }
            }
        }
        
        // Reset dirty flag since this is freshly generated
        chunk.dirty = false;
        
        return chunk;
    }

    /**
     * Get spawn point for this world
     * @returns {{x: number, y: number, z: number}}
     */
    getSpawnPoint() {
        return {
            x: 0,
            y: this.groundHeight + 2, // 2 blocks above ground
            z: 0
        };
    }

    /**
     * Get generator info
     * @returns {Object}
     */
    getInfo() {
        return {
            type: 'flatworld',
            grassLayers: this.grassLayers,
            dirtLayers: this.dirtLayers,
            stoneLayers: this.stoneLayers,
            groundHeight: this.groundHeight
        };
    }
}

module.exports = { FlatworldGenerator };
