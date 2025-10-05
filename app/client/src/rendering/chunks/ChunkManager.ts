import * as THREE from 'three';
import { GeometryBuilder } from '../geometry/GeometryBuilder';

interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  blocks: Uint16Array;
  version?: number;
}

interface CachedChunk {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  version: number;
  lastAccess: number;
}

export class ChunkManager {
  private chunks = new Map<string, CachedChunk>();
  private material: THREE.Material;
  private maxCached = 1000;

  constructor(texture?: THREE.Texture) {
    this.material = new THREE.MeshStandardMaterial({
      map: texture || null,
      side: THREE.DoubleSide, // Temporary: render both sides for debugging
      roughness: 1.0,
      metalness: 0.0,
      color: texture ? 0xffffff : 0x88cc88
    });

    if (texture) {
      texture.needsUpdate = true;
    }
  }

  getOrCreateMesh(chunk: ChunkData): THREE.Mesh | null {
    const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
    const cached = this.chunks.get(key);
    const version = chunk.version || 0;

    if (cached) {
      if (cached.version === version) {
        cached.lastAccess = Date.now();
        return cached.mesh;
      } else {
        this.removeMesh(chunk.cx, chunk.cy, chunk.cz);
      }
    }

    const geometry = GeometryBuilder.buildGeometry(chunk);
    if (!geometry) return null;

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.frustumCulled = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();

    this.chunks.set(key, {
      mesh,
      geometry,
      version,
      lastAccess: Date.now()
    });

    this.cleanup();
    return mesh;
  }

  removeMesh(cx: number, cy: number, cz: number): void {
    const key = `${cx},${cy},${cz}`;
    const cached = this.chunks.get(key);
    
    if (cached) {
      cached.geometry.dispose();
      this.chunks.delete(key);
    }
  }

  private cleanup(): void {
    if (this.chunks.size <= this.maxCached) return;

    const sorted = Array.from(this.chunks.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toRemove = Math.floor(this.maxCached * 0.2);
    for (let i = 0; i < toRemove; i++) {
      const [key, cached] = sorted[i];
      cached.geometry.dispose();
      this.chunks.delete(key);
    }
  }

  dispose(): void {
    for (const cached of this.chunks.values()) {
      cached.geometry.dispose();
    }
    this.chunks.clear();
    this.material.dispose();
  }

  getStats() {
    let vertices = 0;
    let triangles = 0;

    for (const cached of this.chunks.values()) {
      const pos = cached.geometry.attributes.position;
      if (pos) vertices += pos.count;
      
      const idx = cached.geometry.index;
      if (idx) triangles += idx.count / 3;
    }

    return {
      chunks: this.chunks.size,
      vertices,
      triangles
    };
  }
}
