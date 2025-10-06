import * as THREE from 'three';
import { textureManager } from '../textures/TextureManager';
import { calculateFaceAO, calculateDirectionalShading } from '../../utils/AmbientOcclusion';

const CHUNK_SIZE = 16;

interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  blocks: Uint16Array;
}

let hasLoggedUVs = false; // Debug flag

/**
 * Face definitions for a unit cube
 * Vertices are in counter-clockwise order when viewed from outside
 */
const CUBE_FACES = [
  {
    name: 'top',
    direction: [0, 1, 0],
    vertices: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0]
    ],
    faceIndex: 0
  },
  {
    name: 'bottom',
    direction: [0, -1, 0],
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1]
    ],
    faceIndex: 1
  },
  {
    name: 'east',
    direction: [1, 0, 0],
    vertices: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1]
    ],
    faceIndex: 2
  },
  {
    name: 'west',
    direction: [-1, 0, 0],
    vertices: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0]
    ],
    faceIndex: 3
  },
  {
    name: 'south',
    direction: [0, 0, 1],
    vertices: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1]
    ],
    faceIndex: 4
  },
  {
    name: 'north',
    direction: [0, 0, -1],
    vertices: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0]
    ],
    faceIndex: 5
  }
];

export class GeometryBuilder {
  private static getBlockAt(blocks: Uint16Array, x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
    return blocks[index] || 0;
  }

  static buildGeometry(chunk: ChunkData, enableAO: boolean = true): THREE.BufferGeometry | null {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const offsetX = chunk.cx * CHUNK_SIZE;
    const offsetY = chunk.cy * CHUNK_SIZE;
    const offsetZ = chunk.cz * CHUNK_SIZE;

    // Helper function to check if a block is solid (for AO calculation)
    const isSolid = (x: number, y: number, z: number): boolean => {
      return this.getBlockAt(chunk.blocks, x, y, z) !== 0;
    };

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const blockId = this.getBlockAt(chunk.blocks, x, y, z);
          if (blockId === 0) continue;

          const worldX = offsetX + x;
          const worldY = offsetY + y;
          const worldZ = offsetZ + z;

          for (const face of CUBE_FACES) {
            const [dx, dy, dz] = face.direction;
            const neighborBlock = this.getBlockAt(chunk.blocks, x + dx, y + dy, z + dz);
            
            if (neighborBlock === 0) {
              const uvCoordinates = textureManager.getUVs(blockId, face.faceIndex);
              
              // Calculate directional shading (base lighting from face orientation)
              const directionalShading = calculateDirectionalShading(face.name);
              
              // Calculate per-vertex AO if enabled
              let vertexAO: [number, number, number, number] = [1, 1, 1, 1];
              if (enableAO) {
                vertexAO = calculateFaceAO(
                  isSolid,
                  x, y, z,
                  dx, dy, dz,
                  face.name  // Pass face name for correct vertex mapping
                );
              }
              
              this.createQuad(
                positions,
                normals,
                uvs,
                indices,
                colors,
                worldX,
                worldY,
                worldZ,
                face.vertices,
                face.direction,
                uvCoordinates,
                directionalShading,
                vertexAO,
                enableAO
              );
            }
          }
        }
      }
    }

    if (positions.length === 0) {
      return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    
    // Always set vertex colors for proper voxel shading
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    
    return geometry;
  }

  private static createQuad(
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    colors: number[],
    baseX: number,
    baseY: number,
    baseZ: number,
    vertices: number[][],
    normal: number[],
    uvCoordinates: number[],
    directionalShading: number,
    vertexAO: [number, number, number, number],
    enableAO: boolean
  ): void {
    const vertexIndex = positions.length / 3;

    // Add vertices with per-vertex lighting (directional + AO combined)
    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      positions.push(
        baseX + vertex[0],
        baseY + vertex[1],
        baseZ + vertex[2]
      );
      normals.push(normal[0], normal[1], normal[2]);
      
      // Combine directional shading with per-vertex AO
      const finalBrightness = enableAO 
        ? directionalShading * vertexAO[i]  // Multiply base shading by AO
        : directionalShading;                // Only directional if AO disabled
      
      colors.push(finalBrightness, finalBrightness, finalBrightness);
    }

    const [u0, v0, u1, v1] = uvCoordinates;
    
    // Debug: Log UV coordinates for the first quad only
    if (!hasLoggedUVs) {
      console.log('[GeometryBuilder] UV coordinates from atlas:');
      console.log(`  u0=${u0}, v0=${v0}, u1=${u1}, v1=${v1}`);
      console.log(`  Applied UVs (flipped V):`);
      console.log(`    [${u0}, ${1.0 - v1}], [${u1}, ${1.0 - v1}], [${u1}, ${1.0 - v0}], [${u0}, ${1.0 - v0}]`);
      hasLoggedUVs = true;
    }
    
    uvs.push(
      u0, 1.0 - v1,
      u1, 1.0 - v1,
      u1, 1.0 - v0,
      u0, 1.0 - v0
    );

    indices.push(
      vertexIndex + 0, vertexIndex + 1, vertexIndex + 2,
      vertexIndex + 0, vertexIndex + 2, vertexIndex + 3
    );
  }
}
