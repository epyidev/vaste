import * as THREE from 'three';
import { textureManager } from '../textures/TextureManager';

const CHUNK_SIZE = 16;

interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  blocks: Uint16Array;
}

interface GeometryData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export class GeometryBuilder {
  private static getBlockId(blocks: Uint16Array, x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    // Match server indexing: (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x
    const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
    return blocks[index] || 0;
  }

  private static shouldRenderFace(blocks: Uint16Array, x: number, y: number, z: number, dx: number, dy: number, dz: number): boolean {
    return this.getBlockId(blocks, x + dx, y + dy, z + dz) === 0;
  }

  private static getUVs(blockId: number, faceIndex: number): number[] {
    const [u0, v0, u1, v1] = textureManager.getUVs(blockId, faceIndex);
    
    // Debug: log first UV calculation
    if (!this.hasLoggedUVs) {
      console.log(`[GeometryBuilder] First UV calc: blockId=${blockId}, face=${faceIndex}, UVs=[${u0}, ${v0}, ${u1}, ${v1}]`);
      this.hasLoggedUVs = true;
    }
    
    return [u0, v0, u1, v1];
  }

  private static hasLoggedUVs = false;

  static buildGeometry(chunk: ChunkData): THREE.BufferGeometry | null {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const offsetX = chunk.cx * CHUNK_SIZE;
    const offsetY = chunk.cy * CHUNK_SIZE;
    const offsetZ = chunk.cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const blockId = this.getBlockId(chunk.blocks, x, y, z);
          if (blockId === 0) continue;

          const wx = offsetX + x;
          const wy = offsetY + y;
          const wz = offsetZ + z;

          if (this.shouldRenderFace(chunk.blocks, x, y, z, 0, 1, 0)) {
            const faceUVs = this.getUVs(blockId, 0);
            this.addFace(positions, normals, uvs, indices, wx, wy + 1, wz, 1, 0, 0, 0, 0, 1, 0, 1, 0, faceUVs);
          }

          if (this.shouldRenderFace(chunk.blocks, x, y, z, 0, -1, 0)) {
            const faceUVs = this.getUVs(blockId, 1);
            this.addFace(positions, normals, uvs, indices, wx, wy, wz, 1, 0, 0, 0, 0, -1, 0, -1, 0, faceUVs);
          }

          if (this.shouldRenderFace(chunk.blocks, x, y, z, 1, 0, 0)) {
            const faceUVs = this.getUVs(blockId, 2);
            this.addFace(positions, normals, uvs, indices, wx + 1, wy, wz, 0, 1, 0, 0, 0, 1, 1, 0, 0, faceUVs);
          }

          if (this.shouldRenderFace(chunk.blocks, x, y, z, -1, 0, 0)) {
            const faceUVs = this.getUVs(blockId, 3);
            this.addFace(positions, normals, uvs, indices, wx, wy, wz, 0, 1, 0, 0, 0, -1, -1, 0, 0, faceUVs);
          }

          if (this.shouldRenderFace(chunk.blocks, x, y, z, 0, 0, 1)) {
            const faceUVs = this.getUVs(blockId, 4);
            this.addFace(positions, normals, uvs, indices, wx, wy, wz + 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, faceUVs);
          }

          if (this.shouldRenderFace(chunk.blocks, x, y, z, 0, 0, -1)) {
            const faceUVs = this.getUVs(blockId, 5);
            this.addFace(positions, normals, uvs, indices, wx, wy, wz, -1, 0, 0, 0, 1, 0, 0, 0, -1, faceUVs);
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
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    return geometry;
  }

  private static addFace(
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    x: number,
    y: number,
    z: number,
    du: number,
    dv: number,
    dw: number,
    su: number,
    sv: number,
    sw: number,
    nx: number,
    ny: number,
    nz: number,
    uvCoords: number[]
  ): void {
    const startIndex = positions.length / 3;

    positions.push(
      x, y, z,
      x + du, y + dv, z + dw,
      x + du + su, y + dv + sv, z + dw + sw,
      x + su, y + sv, z + sw
    );

    for (let i = 0; i < 4; i++) {
      normals.push(nx, ny, nz);
    }

    // Canvas Y goes down, WebGL texture V goes up
    // So we need to flip V coordinates
    const [u0, v0, u1, v1] = uvCoords;
    const v0_flip = 1.0 - v0;
    const v1_flip = 1.0 - v1;
    
    // UV order matches vertex order: 
    // vertex 0: (x, y, z) -> (u0, v1_flip)
    // vertex 1: (x+du, y+dv, z+dw) -> (u1, v1_flip)
    // vertex 2: (x+du+su, y+dv+sv, z+dw+sw) -> (u1, v0_flip)
    // vertex 3: (x+su, y+sv, z+sw) -> (u0, v0_flip)
    uvs.push(u0, v1_flip, u1, v1_flip, u1, v0_flip, u0, v0_flip);

    indices.push(
      startIndex, startIndex + 1, startIndex + 2,
      startIndex, startIndex + 2, startIndex + 3
    );
  }
}
