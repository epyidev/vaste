/**
 * chunkMeshWorker.ts - Web Worker for generating chunk meshes
 * Generates optimized meshes for cubic 16x16x16 chunks
 */

import {
  CHUNK_SIZE,
  ChunkData,
  ChunkMesh,
  FaceDirection,
  FACE_VERTICES,
  FACE_NORMALS,
  FACE_UVS,
} from "../types";

/**
 * Check if a block is solid (not air)
 */
function isSolid(blockType: number): boolean {
  return blockType !== 0;
}

/**
 * Get block type at local coordinates
 */
function getBlock(chunkData: ChunkData, x: number, y: number, z: number): number {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
    return 0; // Air outside chunk bounds
  }

  const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
  return chunkData.blocksArray[index];
}

/**
 * Check if a face should be rendered
 */
function shouldRenderFace(
  chunkData: ChunkData,
  x: number,
  y: number,
  z: number,
  direction: FaceDirection,
  neighborChunks: Map<string, ChunkData>
): boolean {
  let nx = x;
  let ny = y;
  let nz = z;
  let neighborChunk: ChunkData | null = null;

  switch (direction) {
    case FaceDirection.TOP:
      ny++;
      break;
    case FaceDirection.BOTTOM:
      ny--;
      break;
    case FaceDirection.NORTH:
      nz--;
      break;
    case FaceDirection.SOUTH:
      nz++;
      break;
    case FaceDirection.EAST:
      nx++;
      break;
    case FaceDirection.WEST:
      nx--;
      break;
  }

  // Check within same chunk
  if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
    const neighborType = getBlock(chunkData, nx, ny, nz);
    return !isSolid(neighborType);
  }

  // Check neighbor chunk
  let neighborCx = chunkData.cx;
  let neighborCy = chunkData.cy;
  let neighborCz = chunkData.cz;

  if (nx < 0) {
    neighborCx--;
    nx += CHUNK_SIZE;
  } else if (nx >= CHUNK_SIZE) {
    neighborCx++;
    nx -= CHUNK_SIZE;
  }

  if (ny < 0) {
    neighborCy--;
    ny += CHUNK_SIZE;
  } else if (ny >= CHUNK_SIZE) {
    neighborCy++;
    ny -= CHUNK_SIZE;
  }

  if (nz < 0) {
    neighborCz--;
    nz += CHUNK_SIZE;
  } else if (nz >= CHUNK_SIZE) {
    neighborCz++;
    nz -= CHUNK_SIZE;
  }

  const neighborKey = `${neighborCx},${neighborCy},${neighborCz}`;
  neighborChunk = neighborChunks.get(neighborKey) || null;

  if (!neighborChunk) {
    // No neighbor chunk loaded - render face
    return true;
  }

  const neighborType = getBlock(neighborChunk, nx, ny, nz);
  return !isSolid(neighborType);
}

/**
 * Generate mesh for a chunk
 */
function generateChunkMesh(
  chunkData: ChunkData,
  neighborChunks: Map<string, ChunkData>
): ChunkMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const blockTypes: number[] = [];

  let vertexCount = 0;

  // Iterate through all blocks in chunk
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const blockType = getBlock(chunkData, x, y, z);
        
        if (!isSolid(blockType)) {
          continue; // Skip air blocks
        }

        // Check all 6 faces
        for (let face = 0; face < 6; face++) {
          const direction = face as FaceDirection;

          if (!shouldRenderFace(chunkData, x, y, z, direction, neighborChunks)) {
            continue; // Skip faces that are hidden
          }

          // Add face vertices
          const faceVertices = FACE_VERTICES[direction];
          const normal = FACE_NORMALS[direction];

          for (let i = 0; i < 4; i++) {
            const vertex = faceVertices[i];
            positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
            normals.push(normal[0], normal[1], normal[2]);
            uvs.push(FACE_UVS[i][0], FACE_UVS[i][1]);
            blockTypes.push(blockType);
          }

          // Add face indices (two triangles)
          const baseIndex = vertexCount;
          indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex, baseIndex + 2, baseIndex + 3
          );

          vertexCount += 4;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    blockTypes: new Uint16Array(blockTypes),
  };
}

/**
 * Worker message handler
 */
self.onmessage = (e: MessageEvent) => {
  const { type, chunkData, neighborChunks, requestId } = e.data;

  try {
    if (type === "generate_mesh") {
      // Convert neighbor chunks array to map
      const neighborMap = new Map<string, ChunkData>();
      if (neighborChunks && Array.isArray(neighborChunks)) {
        for (const chunk of neighborChunks) {
          const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
          neighborMap.set(key, chunk);
        }
      }

      // Generate mesh
      const mesh = generateChunkMesh(chunkData, neighborMap);

      // Send result back to main thread
      self.postMessage({
        type: "mesh_generated",
        requestId,
        mesh,
      });
    } else {
      self.postMessage({
        type: "error",
        requestId,
        error: `Unknown message type: ${type}`,
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
