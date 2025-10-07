/**
 * Region.js - Region container for 32x32x32 chunks
 * A region represents a 512x512x512 block volume
 * This reduces file count and improves I/O performance
 */

const { Chunk, CHUNK_SIZE } = require('./Chunk');

const REGION_SIZE = 32; // 32 chunks per dimension
const CHUNKS_PER_REGION = REGION_SIZE * REGION_SIZE * REGION_SIZE; // 32768 chunks

class Region {
    /**
     * Create a new region
     * @param {number} rx - Region X coordinate
     * @param {number} ry - Region Y coordinate
     * @param {number} rz - Region Z coordinate
     */
    constructor(rx, ry, rz) {
        this.rx = rx;
        this.ry = ry;
        this.rz = rz;
        
        // Sparse storage: only store non-empty chunks
        // Key format: "x,y,z" (local chunk coords 0-31)
        this.chunks = new Map();
        
        // Track if region has been modified
        this.dirty = false;
    }

    /**
     * Get key for chunk within region
     * @param {number} cx - Local chunk X (0-31)
     * @param {number} cy - Local chunk Y (0-31)
     * @param {number} cz - Local chunk Z (0-31)
     * @returns {string}
     */
    static getChunkKey(cx, cy, cz) {
        return `${cx},${cy},${cz}`;
    }

    /**
     * Get chunk at local coordinates, create if needed
     * @param {number} cx - Local chunk X (0-31)
     * @param {number} cy - Local chunk Y (0-31)
     * @param {number} cz - Local chunk Z (0-31)
     * @returns {Chunk}
     */
    getOrCreateChunk(cx, cy, cz) {
        const key = Region.getChunkKey(cx, cy, cz);
        let chunk = this.chunks.get(key);
        
        if (!chunk) {
            // Calculate global chunk coordinates
            const globalCx = this.rx * REGION_SIZE + cx;
            const globalCy = this.ry * REGION_SIZE + cy;
            const globalCz = this.rz * REGION_SIZE + cz;
            
            chunk = new Chunk(globalCx, globalCy, globalCz);
            this.chunks.set(key, chunk);
        }
        
        return chunk;
    }

    /**
     * Get chunk at local coordinates, or null if not loaded
     * @param {number} cx - Local chunk X (0-31)
     * @param {number} cy - Local chunk Y (0-31)
     * @param {number} cz - Local chunk Z (0-31)
     * @returns {Chunk|null}
     */
    getChunk(cx, cy, cz) {
        const key = Region.getChunkKey(cx, cy, cz);
        return this.chunks.get(key) || null;
    }

    /**
     * Set chunk at local coordinates
     * @param {number} cx - Local chunk X (0-31)
     * @param {number} cy - Local chunk Y (0-31)
     * @param {number} cz - Local chunk Z (0-31)
     * @param {Chunk} chunk - Chunk instance
     */
    setChunk(cx, cy, cz, chunk) {
        const key = Region.getChunkKey(cx, cy, cz);
        this.chunks.set(key, chunk);
        this.dirty = true;
    }

    /**
     * Remove chunk from region if it's empty
     * @param {number} cx - Local chunk X (0-31)
     * @param {number} cy - Local chunk Y (0-31)
     * @param {number} cz - Local chunk Z (0-31)
     */
    removeChunkIfEmpty(cx, cy, cz) {
        const key = Region.getChunkKey(cx, cy, cz);
        const chunk = this.chunks.get(key);
        
        if (chunk && chunk.isEmpty()) {
            this.chunks.delete(key);
            this.dirty = true;
        }
    }

    /**
     * Get all chunks in this region
     * @returns {Chunk[]}
     */
    getAllChunks() {
        return Array.from(this.chunks.values());
    }

    /**
     * Check if region is empty
     * @returns {boolean}
     */
    isEmpty() {
        return this.chunks.size === 0;
    }

    /**
     * Serialize region to buffer for STORAGE
     * Format: [chunkCount:uint32][chunk1][chunk2]...
     * Each chunk: [localX:uint8][localY:uint8][localZ:uint8][chunkDataSize:uint32][chunkData]
     * 
     * Note: Chunk data uses STRING IDs (variable size due to JSON format)
     * 
     * @returns {Buffer}
     */
    serialize() {
        const chunks = this.getAllChunks();
        const buffers = [];
        
        // Header: chunk count
        const headerBuffer = Buffer.allocUnsafe(4);
        headerBuffer.writeUInt32LE(chunks.length, 0);
        buffers.push(headerBuffer);
        
        // Each chunk
        for (const chunk of chunks) {
            // Calculate local coordinates
            const localCx = chunk.cx - (this.rx * REGION_SIZE);
            const localCy = chunk.cy - (this.ry * REGION_SIZE);
            const localCz = chunk.cz - (this.rz * REGION_SIZE);
            
            // Serialize chunk data (uses string IDs)
            const chunkData = chunk.serialize();
            
            // Chunk header: local coords (3 bytes) + data size (4 bytes)
            const chunkHeader = Buffer.allocUnsafe(7);
            chunkHeader.writeUInt8(localCx, 0);
            chunkHeader.writeUInt8(localCy, 1);
            chunkHeader.writeUInt8(localCz, 2);
            chunkHeader.writeUInt32LE(chunkData.length, 3);
            buffers.push(chunkHeader);
            
            // Chunk data
            buffers.push(chunkData);
        }
        
        return Buffer.concat(buffers);
    }

    /**
     * Deserialize region from buffer for STORAGE
     * @param {Buffer} buffer - Serialized region data
     * @param {number} rx - Region X
     * @param {number} ry - Region Y
     * @param {number} rz - Region Z
     * @returns {Region}
     */
    static deserialize(buffer, rx, ry, rz) {
        const region = new Region(rx, ry, rz);
        
        let offset = 0;
        const chunkCount = buffer.readUInt32LE(offset);
        offset += 4;
        
        for (let i = 0; i < chunkCount; i++) {
            // Read local coordinates
            const localCx = buffer.readUInt8(offset);
            const localCy = buffer.readUInt8(offset + 1);
            const localCz = buffer.readUInt8(offset + 2);
            const chunkDataSize = buffer.readUInt32LE(offset + 3);
            offset += 7;
            
            // Calculate global coordinates
            const globalCx = rx * REGION_SIZE + localCx;
            const globalCy = ry * REGION_SIZE + localCy;
            const globalCz = rz * REGION_SIZE + localCz;
            
            // Read chunk data
            const chunkBuffer = buffer.slice(offset, offset + chunkDataSize);
            const chunk = Chunk.deserialize(chunkBuffer, globalCx, globalCy, globalCz);
            
            region.setChunk(localCx, localCy, localCz, chunk);
            offset += chunkDataSize;
        }
        
        region.dirty = false;
        return region;
    }
}

module.exports = { Region, REGION_SIZE, CHUNKS_PER_REGION };
