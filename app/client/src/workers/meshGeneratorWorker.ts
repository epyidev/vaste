/**
 * Mesh Generator Worker
 * Génère les meshes de chunks de manière asynchrone pour éviter les freezes
 */

import { blockMapping } from "../data/BlockRegistry";

const CHUNK_SIZE = 16;

interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  blocksArray: Uint16Array;
}

interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  blockType: number;
}

interface GenerateMeshRequest {
  type: 'generate';
  requestId: number;
  chunk: ChunkData;
  neighborChunks: Map<string, Uint16Array>; // Pour face culling
}

interface LoadMappingRequest {
  type: 'loadMapping';
  mappings: { stringId: string; numericId: number }[];
}

// Helper: Get block from chunk
function getBlock(blocksArray: Uint16Array, x: number, y: number, z: number): number {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
    return 0; // Air
  }
  const idx = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
  return blocksArray[idx];
}

// Helper: Check if block is solid (for face culling)
function isSolid(blockType: number): boolean {
  if (blockType === 0) return false; // Air
  // Pour l'instant, tous les blocs non-air sont solides
  // TODO: Utiliser blockMapping pour vérifier la solidité
  return true;
}

// Helper: Check if neighbor block is solid
function isNeighborSolid(
  chunk: ChunkData,
  neighborChunks: Map<string, Uint16Array>,
  x: number,
  y: number,
  z: number
): boolean {
  // Si dans le chunk actuel
  if (x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
    return isSolid(getBlock(chunk.blocksArray, x, y, z));
  }

  // Sinon, chercher dans les chunks voisins
  let neighborCx = chunk.cx;
  let neighborCy = chunk.cy;
  let neighborCz = chunk.cz;
  let localX = x;
  let localY = y;
  let localZ = z;

  if (x < 0) { neighborCx--; localX = CHUNK_SIZE + x; }
  else if (x >= CHUNK_SIZE) { neighborCx++; localX = x - CHUNK_SIZE; }

  if (y < 0) { neighborCy--; localY = CHUNK_SIZE + y; }
  else if (y >= CHUNK_SIZE) { neighborCy++; localY = y - CHUNK_SIZE; }

  if (z < 0) { neighborCz--; localZ = CHUNK_SIZE + z; }
  else if (z >= CHUNK_SIZE) { neighborCz++; localZ = z - CHUNK_SIZE; }

  const key = `${neighborCx},${neighborCy},${neighborCz}`;
  const neighborBlocks = neighborChunks.get(key);

  if (!neighborBlocks) {
    return false; // Chunk voisin pas chargé = considérer comme air
  }

  return isSolid(getBlock(neighborBlocks, localX, localY, localZ));
}

// Generate mesh for a single block type
function generateMeshForBlockType(
  chunk: ChunkData,
  neighborChunks: Map<string, Uint16Array>,
  targetBlockType: number
): MeshData | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  // Parcourir tous les blocs du chunk
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const blockType = getBlock(chunk.blocksArray, x, y, z);

        // Ignorer si pas le bon type de bloc
        if (blockType !== targetBlockType) continue;

        // Générer les faces visibles (face culling)
        const worldX = chunk.cx * CHUNK_SIZE + x;
        const worldY = chunk.cy * CHUNK_SIZE + y;
        const worldZ = chunk.cz * CHUNK_SIZE + z;

        // Face +X (droite)
        if (!isNeighborSolid(chunk, neighborChunks, x + 1, y, z)) {
          positions.push(
            x + 1, y, z,
            x + 1, y + 1, z,
            x + 1, y + 1, z + 1,
            x + 1, y, z + 1
          );
          normals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
          uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }

        // Face -X (gauche)
        if (!isNeighborSolid(chunk, neighborChunks, x - 1, y, z)) {
          positions.push(
            x, y, z + 1,
            x, y + 1, z + 1,
            x, y + 1, z,
            x, y, z
          );
          normals.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
          uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }

        // Face +Y (dessus)
        if (!isNeighborSolid(chunk, neighborChunks, x, y + 1, z)) {
          positions.push(
            x, y + 1, z,
            x, y + 1, z + 1,
            x + 1, y + 1, z + 1,
            x + 1, y + 1, z
          );
          normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
          uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }

        // Face -Y (dessous)
        if (!isNeighborSolid(chunk, neighborChunks, x, y - 1, z)) {
          positions.push(
            x, y, z + 1,
            x, y, z,
            x + 1, y, z,
            x + 1, y, z + 1
          );
          normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
          uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }

        // Face +Z (avant)
        if (!isNeighborSolid(chunk, neighborChunks, x, y, z + 1)) {
          positions.push(
            x, y, z + 1,
            x, y + 1, z + 1,
            x + 1, y + 1, z + 1,
            x + 1, y, z + 1
          );
          normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
          uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }

        // Face -Z (arrière)
        if (!isNeighborSolid(chunk, neighborChunks, x, y, z - 1)) {
          positions.push(
            x + 1, y, z,
            x + 1, y + 1, z,
            x, y + 1, z,
            x, y, z
          );
          normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
          uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }
      }
    }
  }

  // Si aucun vertex, retourner null
  if (positions.length === 0) {
    return null;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    blockType: targetBlockType,
  };
}

// Message handler
self.onmessage = (e: MessageEvent) => {
  const message = e.data;

  if (message.type === 'loadMapping') {
    const req = message as LoadMappingRequest;
    // Charger la table de mapping dans le worker
    blockMapping.loadMappingTable(req.mappings);
    self.postMessage({ type: 'mappingLoaded' });
    return;
  }

  if (message.type === 'generate') {
    const req = message as GenerateMeshRequest;

    try {
      // Convertir neighborChunks Map (sérialisé en array)
      const neighborChunks = new Map<string, Uint16Array>();
      if (req.neighborChunks) {
        Object.entries(req.neighborChunks).forEach(([key, value]) => {
          neighborChunks.set(key, new Uint16Array(value));
        });
      }

      // Trouver tous les types de blocs uniques dans le chunk
      const blockTypes = new Set<number>();
      for (let i = 0; i < req.chunk.blocksArray.length; i++) {
        const blockType = req.chunk.blocksArray[i];
        if (blockType !== 0) { // Ignorer l'air
          blockTypes.add(blockType);
        }
      }

      // Générer mesh pour chaque type de bloc
      const meshes: MeshData[] = [];
      for (const blockType of blockTypes) {
        const mesh = generateMeshForBlockType(req.chunk, neighborChunks, blockType);
        if (mesh) {
          meshes.push(mesh);
        }
      }

      // Envoyer les meshes au thread principal
      const transferables = meshes.flatMap(m => [m.positions.buffer, m.normals.buffer, m.uvs.buffer, m.indices.buffer]);
      
      self.postMessage({
        type: 'meshGenerated',
        requestId: req.requestId,
        chunkKey: `${req.chunk.cx},${req.chunk.cy},${req.chunk.cz}`,
        meshes,
      }, { transfer: transferables });

    } catch (error) {
      self.postMessage({
        type: 'error',
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

console.log('[MeshGeneratorWorker] Worker initialized');
