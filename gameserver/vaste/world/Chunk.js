/**
 * Chunk.js - Cubic chunk implementation (16x16x16)
 * Each chunk stores 4096 voxels in a Uint16Array
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
        
        // Block data stored as Uint16Array (0 = air, 1-65535 = block types)
        this.blocks = new Uint16Array(VOXELS_PER_CHUNK);
        
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
     * Serialize chunk to buffer for network or storage
     * Format: [version:uint32][nonEmptyCount:uint32][blocks:Uint16Array]
     * @returns {Buffer}
     */
    serialize() {
        const buffer = Buffer.allocUnsafe(8 + (VOXELS_PER_CHUNK * 2));
        buffer.writeUInt32LE(this.version, 0);
        buffer.writeUInt32LE(this.nonEmptyCount, 4);
        
        // Copy blocks data
        for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
            buffer.writeUInt16LE(this.blocks[i], 8 + (i * 2));
        }
        
        return buffer;
    }

    /**
     * Deserialize chunk from buffer
     * @param {Buffer} buffer - Serialized chunk data
     * @param {number} cx - Chunk X
     * @param {number} cy - Chunk Y
     * @param {number} cz - Chunk Z
     * @returns {Chunk}
     */
    static deserialize(buffer, cx, cy, cz) {
        const chunk = new Chunk(cx, cy, cz);
        
        chunk.version = buffer.readUInt32LE(0);
        chunk.nonEmptyCount = buffer.readUInt32LE(4);
        
        // Read blocks data
        for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
            chunk.blocks[i] = buffer.readUInt16LE(8 + (i * 2));
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
        copy.version = this.version;
        copy.nonEmptyCount = this.nonEmptyCount;
        copy.dirty = this.dirty;
        return copy;
    }
}

module.exports = { Chunk, CHUNK_SIZE, VOXELS_PER_CHUNK };
