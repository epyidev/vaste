/**
 * ChunkProtocol.js - Network protocol for chunk synchronization
 * Simple binary format for efficient chunk transmission
 */

const { CHUNK_SIZE, VOXELS_PER_CHUNK } = require('./Chunk');

/**
 * Message types
 */
const MessageType = {
    WORLD_ASSIGN: 1,      // Server -> Client: Assign player to a world
    CHUNK_DATA: 2,        // Server -> Client: Full chunk data
    CHUNK_UPDATE: 3,      // Server -> Client: Single block update
    BLOCK_PLACE: 4,       // Client -> Server: Place block
    BLOCK_BREAK: 5,       // Client -> Server: Break block
};

class ChunkProtocol {
    /**
     * Create a world assignment message
     * @param {Object} worldInfo - World information
     * @param {string} worldInfo.worldId - World ID
     * @param {Object} worldInfo.spawnPoint - Spawn point {x, y, z}
     * @param {string} worldInfo.generatorType - Generator type
     * @returns {string} JSON message
     */
    static createWorldAssignMessage(worldInfo) {
        return JSON.stringify({
            type: 'world_assign',
            worldId: worldInfo.worldId || 'main',
            spawnPoint: worldInfo.spawnPoint,
            generatorType: worldInfo.generatorType,
            maxRenderDistance: worldInfo.maxRenderDistance,
            forceRenderDistance: worldInfo.forceRenderDistance,
            timestamp: Date.now()
        });
    }

    /**
     * Serialize a chunk for network transmission
     * Binary format (uses NUMERIC IDs for efficiency):
     * - messageType: uint8 (1 byte) = 2 (CHUNK_DATA)
     * - cx: int32 (4 bytes)
     * - cy: int32 (4 bytes)
     * - cz: int32 (4 bytes)
     * - version: uint32 (4 bytes)
     * - blocks: uint16[4096] (8192 bytes)
     * Total: 8205 bytes per chunk
     * 
     * Note: Uses numeric IDs which are temporary and regenerated at each server start
     * 
     * @param {Chunk} chunk - Chunk to serialize
     * @returns {Buffer}
     */
    static serializeChunk(chunk) {
        const buffer = Buffer.allocUnsafe(1 + 4 + 4 + 4 + 4 + (VOXELS_PER_CHUNK * 2));
        let offset = 0;
        
        // Message type
        buffer.writeUInt8(MessageType.CHUNK_DATA, offset);
        offset += 1;
        
        // Chunk coordinates
        buffer.writeInt32LE(chunk.cx, offset);
        offset += 4;
        buffer.writeInt32LE(chunk.cy, offset);
        offset += 4;
        buffer.writeInt32LE(chunk.cz, offset);
        offset += 4;
        
        // Version
        buffer.writeUInt32LE(chunk.version, offset);
        offset += 4;
        
        // Block data (numeric IDs)
        for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
            buffer.writeUInt16LE(chunk.blocks[i], offset);
            offset += 2;
        }
        
        return buffer;
    }

    /**
     * Deserialize a chunk from network data
     * Receives data with NUMERIC IDs (temporary, session-specific)
     * 
     * @param {Buffer} buffer - Binary chunk data
     * @returns {Object} Chunk data {cx, cy, cz, version, blocks}
     */
    static deserializeChunk(buffer) {
        let offset = 0;
        
        // Read message type
        const messageType = buffer.readUInt8(offset);
        offset += 1;
        
        if (messageType !== MessageType.CHUNK_DATA) {
            throw new Error(`Invalid message type: ${messageType}, expected ${MessageType.CHUNK_DATA}`);
        }
        
        // Read chunk coordinates
        const cx = buffer.readInt32LE(offset);
        offset += 4;
        const cy = buffer.readInt32LE(offset);
        offset += 4;
        const cz = buffer.readInt32LE(offset);
        offset += 4;
        
        // Read version
        const version = buffer.readUInt32LE(offset);
        offset += 4;
        
        // Read block data (numeric IDs - temporary for this session)
        const blocks = new Uint16Array(VOXELS_PER_CHUNK);
        for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
            blocks[i] = buffer.readUInt16LE(offset);
            offset += 2;
        }
        
        return { cx, cy, cz, version, blocks };
    }

    /**
     * Create a single block update message
     * Binary format (uses NUMERIC IDs):
     * - messageType: uint8 (1 byte) = 3 (CHUNK_UPDATE)
     * - x: int32 (4 bytes)
     * - y: int32 (4 bytes)
     * - z: int32 (4 bytes)
     * - blockType: uint16 (2 bytes) - NUMERIC ID (temporary)
     * Total: 15 bytes
     * 
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {number} z - World Z
     * @param {number} blockType - Block type NUMERIC ID (temporary)
     * @returns {Buffer}
     */
    static serializeBlockUpdate(x, y, z, blockType) {
        const buffer = Buffer.allocUnsafe(15);
        let offset = 0;
        
        buffer.writeUInt8(MessageType.CHUNK_UPDATE, offset);
        offset += 1;
        
        buffer.writeInt32LE(x, offset);
        offset += 4;
        buffer.writeInt32LE(y, offset);
        offset += 4;
        buffer.writeInt32LE(z, offset);
        offset += 4;
        
        buffer.writeUInt16LE(blockType, offset);
        
        return buffer;
    }

    /**
     * Deserialize a block update message
     * Receives NUMERIC ID (temporary, session-specific)
     * 
     * @param {Buffer} buffer - Binary update data
     * @returns {Object} {x, y, z, blockType}
     */
    static deserializeBlockUpdate(buffer) {
        let offset = 0;
        
        const messageType = buffer.readUInt8(offset);
        offset += 1;
        
        if (messageType !== MessageType.CHUNK_UPDATE) {
            throw new Error(`Invalid message type: ${messageType}, expected ${MessageType.CHUNK_UPDATE}`);
        }
        
        const x = buffer.readInt32LE(offset);
        offset += 4;
        const y = buffer.readInt32LE(offset);
        offset += 4;
        const z = buffer.readInt32LE(offset);
        offset += 4;
        
        const blockType = buffer.readUInt16LE(offset);
        
        return { x, y, z, blockType };
    }

    /**
     * Check if a buffer is a binary chunk message
     * @param {Buffer} buffer - Buffer to check
     * @returns {boolean}
     */
    static isBinaryChunkMessage(buffer) {
        if (!buffer || buffer.length < 1) {
            return false;
        }
        
        const messageType = buffer.readUInt8(0);
        return messageType === MessageType.CHUNK_DATA || 
               messageType === MessageType.CHUNK_UPDATE;
    }
}

module.exports = { ChunkProtocol, MessageType };
