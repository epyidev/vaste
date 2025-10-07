/**
 * Chunk.js - Cubic chunk implementation (16x16x16)
 * Each chunk stores 4096 voxels
 * 
 * IMPORTANT: 
 * - Storage uses STRING IDs (persistent, blockpack-independent)
 * - Runtime uses NUMERIC IDs (temporary, for network efficiency)
 */

const CHUNK_SIZE = 16;
const VOXELS_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE; // 4096

class Chunk {
    /**
     * Create a new chunk
     * @param {number} cx - Chunk X coordinate
     * @param {number} cy - Chunk Y coordinate
     * @param {number} cz - Chunk Z coordinate
     */
    constructor(cx, cy, cz) {
        this.cx = cx;
        this.cy = cy;
        this.cz = cz;
        
        // Block data stored as numeric IDs for runtime (memory efficiency)
        // Numeric IDs are temporary and regenerated at each server start
        this.blocks = new Uint16Array(VOXELS_PER_CHUNK);
        
        // Store original string IDs loaded from file to preserve missing blocks
        // Map<index, stringId> - only for blocks that were loaded from file
        // This allows us to preserve string IDs even if blocks don't exist in current blockpacks
        this.originalStringIds = new Map();
        
        // Chunk version for change tracking
        this.version = 1;
        
        // Number of non-air blocks
        this.nonEmptyCount = 0;
        
        // Mark if chunk has been modified since last save
        this.dirty = false;
    }

    /**
     * Get linear index from local coordinates
     * @param {number} x - Local X (0-15)
     * @param {number} y - Local Y (0-15)
     * @param {number} z - Local Z (0-15)
     * @returns {number} Linear index
     */
    static getIndex(x, y, z) {
        return (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
    }

    /**
     * Get local coordinates from linear index
     * @param {number} index - Linear index
     * @returns {{x: number, y: number, z: number}}
     */
    static getCoords(index) {
        const x = index % CHUNK_SIZE;
        const z = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
        const y = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
        return { x, y, z };
    }

    /**
     * Set block at local coordinates
     * @param {number} x - Local X (0-15)
     * @param {number} y - Local Y (0-15)
     * @param {number} z - Local Z (0-15)
     * @param {number} blockType - Block type ID
     */
    setBlock(x, y, z, blockType) {
        const idx = Chunk.getIndex(x, y, z);
        const prevType = this.blocks[idx];
        
        // Update non-empty count
        if (prevType === 0 && blockType !== 0) {
            this.nonEmptyCount++;
        } else if (prevType !== 0 && blockType === 0) {
            this.nonEmptyCount--;
        }
        
        this.blocks[idx] = blockType;
        
        // Clear original string ID when block is modified
        // This ensures we save the new block, not the old missing block
        this.originalStringIds.delete(idx);
        
        this.version++;
        this.dirty = true;
    }

    /**
     * Get block at local coordinates
     * @param {number} x - Local X (0-15)
     * @param {number} y - Local Y (0-15)
     * @param {number} z - Local Z (0-15)
     * @returns {number} Block type ID
     */
    getBlock(x, y, z) {
        const idx = Chunk.getIndex(x, y, z);
        return this.blocks[idx];
    }

    /**
     * Check if chunk is empty (all air)
     * @returns {boolean}
     */
    isEmpty() {
        return this.nonEmptyCount === 0;
    }

    /**
     * Serialize chunk to buffer for STORAGE (uses string IDs)
     * Format: [version:uint32][nonEmptyCount:uint32][blockCount:uint32][blocks:array of {index:uint16, stringId:string}]
     * 
     * Storage format is blockpack-independent and persistent across server restarts
     * Only non-air blocks are stored to save space
     * 
     * IMPORTANT: String IDs are preserved even if the block doesn't exist in current blockpacks
     * This allows blocks to "come back" if the blockpack is re-added later
     * (as long as no player placed another block at that location)
     * 
     * @returns {Buffer}
     */
    serialize() {
        const { blockMapping } = require('../BlockRegistry');
        
        // Collect non-air blocks with their string IDs
        const nonAirBlocks = [];
        for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
            const numericId = this.blocks[i];
            
            // If block was modified (not in originalStringIds), use current numeric ID
            if (!this.originalStringIds.has(i)) {
                if (numericId !== 0) {
                    // Regular block - get current string ID
                    const stringId = blockMapping.getStringId(numericId);
                    if (stringId !== 'vaste:air') {
                        nonAirBlocks.push({ index: i, stringId });
                    }
                }
            } else {
                // Block has original string ID from file
                // Only save it if the block wasn't replaced (is still air in memory)
                if (numericId === 0) {
                    // Block is still air (not replaced) - preserve the string ID
                    nonAirBlocks.push({ 
                        index: i, 
                        stringId: this.originalStringIds.get(i) 
                    });
                } else {
                    // Block was replaced with a real block - use current string ID
                    const stringId = blockMapping.getStringId(numericId);
                    if (stringId !== 'vaste:air') {
                        nonAirBlocks.push({ index: i, stringId });
                    }
                }
            }
        }
        
        // Serialize to JSON for storage (easier to maintain and debug)
        const data = {
            version: this.version,
            nonEmptyCount: this.nonEmptyCount,
            blocks: nonAirBlocks
        };
        
        const jsonString = JSON.stringify(data);
        return Buffer.from(jsonString, 'utf8');
    }

    /**
     * Deserialize chunk from buffer for STORAGE (uses string IDs)
     * 
     * IMPORTANT: If a block's string ID doesn't exist in current blockpacks,
     * it will be rendered as air (ID 0) BUT the string ID is preserved.
     * If the blockpack is re-added later, the block will come back
     * (unless a player placed another block there in the meantime).
     * 
     * @param {Buffer} buffer - Serialized chunk data
     * @param {number} cx - Chunk X
     * @param {number} cy - Chunk Y
     * @param {number} cz - Chunk Z
     * @returns {Chunk}
     */
    static deserialize(buffer, cx, cy, cz) {
        const { blockMapping } = require('../BlockRegistry');
        const chunk = new Chunk(cx, cy, cz);
        
        try {
            const jsonString = buffer.toString('utf8');
            const data = JSON.parse(jsonString);
            
            chunk.version = data.version || 1;
            chunk.nonEmptyCount = 0; // Recalculate from actual blocks
            
            // Restore blocks using current block mappings
            if (data.blocks && Array.isArray(data.blocks)) {
                for (const { index, stringId } of data.blocks) {
                    // Convert string ID to current numeric ID
                    const numericId = blockMapping.getNumericId(stringId);
                    chunk.blocks[index] = numericId;
                    
                    // Preserve original string ID, even for missing blocks
                    // This allows the block to come back if blockpack is re-added
                    chunk.originalStringIds.set(index, stringId);
                    
                    if (numericId !== 0) {
                        chunk.nonEmptyCount++;
                    }
                    // Note: If numericId is 0 (missing block), it renders as air
                    // but the string ID is preserved in originalStringIds
                }
            }
        } catch (error) {
            console.error(`Error deserializing chunk (${cx}, ${cy}, ${cz}):`, error);
            // Return empty chunk on error
        }
        
        chunk.dirty = false;
        return chunk;
    }

    /**
     * Serialize chunk for NETWORK transmission (uses numeric IDs)
     * Binary format for efficiency:
     * [version:uint32][blocks:Uint16Array]
     * 
     * @returns {Buffer}
     */
    serializeForNetwork() {
        const buffer = Buffer.allocUnsafe(4 + (VOXELS_PER_CHUNK * 2));
        buffer.writeUInt32LE(this.version, 0);
        
        // Copy blocks data (numeric IDs)
        for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
            buffer.writeUInt16LE(this.blocks[i], 4 + (i * 2));
        }
        
        return buffer;
    }

    /**
     * Deserialize chunk from NETWORK data (uses numeric IDs)
     * @param {Buffer} buffer - Network chunk data
     * @param {number} cx - Chunk X
     * @param {number} cy - Chunk Y
     * @param {number} cz - Chunk Z
     * @returns {Chunk}
     */
    static deserializeFromNetwork(buffer, cx, cy, cz) {
        const chunk = new Chunk(cx, cy, cz);
        
        chunk.version = buffer.readUInt32LE(0);
        chunk.nonEmptyCount = 0;
        
        // Read blocks data (numeric IDs)
        for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
            const blockId = buffer.readUInt16LE(4 + (i * 2));
            chunk.blocks[i] = blockId;
            if (blockId !== 0) {
                chunk.nonEmptyCount++;
            }
        }
        
        chunk.dirty = false;
        return chunk;
    }

    /**
     * Create a copy of this chunk
     * @returns {Chunk}
     */
    clone() {
        const copy = new Chunk(this.cx, this.cy, this.cz);
        copy.blocks = new Uint16Array(this.blocks);
        copy.originalStringIds = new Map(this.originalStringIds); // Preserve original string IDs
        copy.version = this.version;
        copy.nonEmptyCount = this.nonEmptyCount;
        copy.dirty = this.dirty;
        return copy;
    }
}

module.exports = { Chunk, CHUNK_SIZE, VOXELS_PER_CHUNK };
