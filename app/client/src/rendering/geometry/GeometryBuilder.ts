import * as THREE from 'three';
import { textureManager } from '../textures/TextureManager';

const CHUNK_SIZE = 16;

interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  blocks: Uint16Array;
}

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

  static buildGeometry(chunk: ChunkData, enableAO: boolean = false): THREE.BufferGeometry | null {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const offsetX = chunk.cx * CHUNK_SIZE;
    const offsetY = chunk.cy * CHUNK_SIZE;
    const offsetZ = chunk.cz * CHUNK_SIZE;

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
              const brightness = enableAO ? this.calculateBrightness(face.name) : 1.0;
              
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
                brightness
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
    
    if (enableAO && colors.length > 0) {
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    
    return geometry;
  }

  private static calculateBrightness(faceName: string): number {
    switch (faceName) {
      case 'top':
        return 1.0;
      case 'bottom':
        return 0.5;
      default:
        return 0.75;
    }
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
    brightness: number
  ): void {
    const vertexIndex = positions.length / 3;

    for (const vertex of vertices) {
      positions.push(
        baseX + vertex[0],
        baseY + vertex[1],
        baseZ + vertex[2]
      );
      normals.push(normal[0], normal[1], normal[2]);
      colors.push(brightness, brightness, brightness);
    }

    const [u0, v0, u1, v1] = uvCoordinates;
    
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
