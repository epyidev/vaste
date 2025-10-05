/**
 * chunkDecoderWorker.ts - Web Worker for decoding chunk data 
 * Handles binary chunk messages in a separate thread
 */

const CHUNK_SIZE = 16;
const VOXELS_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;

// Message types
const MessageType = {
  CHUNK_DATA: 2,
  CHUNK_UPDATE: 3,
};

/**
 * Decode a full chunk message
 */
function decodeChunkData(buffer: ArrayBuffer): any {
  const view = new DataView(buffer);
  let offset = 0;

  // Read message type
  const messageType = view.getUint8(offset);
  offset += 1;

  if (messageType !== MessageType.CHUNK_DATA) {
    throw new Error(`Invalid message type: ${messageType}`);
  }

  // Read chunk coordinates
  const cx = view.getInt32(offset, true);
  offset += 4;
  const cy = view.getInt32(offset, true);
  offset += 4;
  const cz = view.getInt32(offset, true);
  offset += 4;

  // Read version
  const version = view.getUint32(offset, true);
  offset += 4;

  // Read block data
  const blocks = new Uint16Array(VOXELS_PER_CHUNK);
  for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
    blocks[i] = view.getUint16(offset, true);
    offset += 2;
  }

  // Convert to sparse block list for rendering
  const blockList: Array<{ x: number; y: number; z: number; type: number }> = [];
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  for (let i = 0; i < VOXELS_PER_CHUNK; i++) {
    const blockType = blocks[i];
    if (blockType === 0) continue; // Skip air

    // Calculate local coordinates from index
    const localX = i % CHUNK_SIZE;
    const temp = Math.floor(i / CHUNK_SIZE);
    const localZ = temp % CHUNK_SIZE;
    const localY = Math.floor(temp / CHUNK_SIZE);

    blockList.push({
      x: baseX + localX,
      y: baseY + localY,
      z: baseZ + localZ,
      type: blockType,
    });
  }

  return {
    cx,
    cy,
    cz,
    version,
    blocks: blockList,
    blocksArray: blocks, // Keep raw array for chunk storage
  };
}

/**
 * Decode a single block update
 */
function decodeBlockUpdate(buffer: ArrayBuffer): any {
  const view = new DataView(buffer);
  let offset = 0;

  // Read message type
  const messageType = view.getUint8(offset);
  offset += 1;

  if (messageType !== MessageType.CHUNK_UPDATE) {
    throw new Error(`Invalid message type: ${messageType}`);
  }

  // Read coordinates
  const x = view.getInt32(offset, true);
  offset += 4;
  const y = view.getInt32(offset, true);
  offset += 4;
  const z = view.getInt32(offset, true);
  offset += 4;

  // Read block type
  const blockType = view.getUint16(offset, true);

  return { x, y, z, blockType };
}

/**
 * Worker message handler
 */
self.onmessage = (e: MessageEvent) => {
  const { type, buffer, requestId } = e.data;

  try {
    if (type === "decode_chunk") {
      const result = decodeChunkData(buffer);
      self.postMessage({
        type: "decoded_chunk",
        requestId,
        data: result,
      });
    } else if (type === "decode_update") {
      const result = decodeBlockUpdate(buffer);
      self.postMessage({
        type: "decoded_update",
        requestId,
        data: result,
      });
    } else {
      self.postMessage({
        type: "error",
        requestId,
        error: `Unknown decode type: ${type}`,
      });
    }
  } catch (error: any) {
    self.postMessage({
      type: "error",
      requestId,
      error: error.message || "Decode error",
    });
  }
};

export {};
