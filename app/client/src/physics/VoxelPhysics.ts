import * as THREE from 'three';

/**
 * Physics and collision detection for voxel world
 */

const CHUNK_SIZE = 16;

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class VoxelPhysics {
  /**
   * Get block at world position
   */
  static getBlockAt(
    chunks: Map<string, any>,
    x: number,
    y: number,
    z: number
  ): number {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    
    const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
    const chunk = chunks.get(chunkKey);
    
    if (!chunk || !chunk.blocksArray) {
      return 0;
    }
    
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const index = (localY * CHUNK_SIZE * CHUNK_SIZE) + (localZ * CHUNK_SIZE) + localX;
    return chunk.blocksArray[index] || 0;
  }

  /**
   * Check if a block is solid
   */
  static isBlockSolid(
    chunks: Map<string, any>,
    x: number,
    y: number,
    z: number
  ): boolean {
    const blockId = this.getBlockAt(chunks, Math.floor(x), Math.floor(y), Math.floor(z));
    return blockId !== 0;
  }

  /**
   * Create AABB from position and size
   */
  static createAABB(x: number, y: number, z: number, width: number, height: number): AABB {
    const halfWidth = width / 2;
    return {
      min: new THREE.Vector3(x - halfWidth, y, z - halfWidth),
      max: new THREE.Vector3(x + halfWidth, y + height, z + halfWidth)
    };
  }

  /**
   * Get all block AABBs that could collide with player AABB
   */
  static getCollisionBlocks(
    chunks: Map<string, any>,
    aabb: AABB
  ): AABB[] {
    const blocks: AABB[] = [];
    
    const minX = Math.floor(aabb.min.x);
    const minY = Math.floor(aabb.min.y);
    const minZ = Math.floor(aabb.min.z);
    const maxX = Math.floor(aabb.max.x);
    const maxY = Math.floor(aabb.max.y);
    const maxZ = Math.floor(aabb.max.z);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.isBlockSolid(chunks, x, y, z)) {
            blocks.push({
              min: new THREE.Vector3(x, y, z),
              max: new THREE.Vector3(x + 1, y + 1, z + 1)
            });
          }
        }
      }
    }
    
    return blocks;
  }

  /**
   * Check if two AABBs intersect
   */
  static aabbIntersects(a: AABB, b: AABB): boolean {
    return (
      a.min.x < b.max.x &&
      a.max.x > b.min.x &&
      a.min.y < b.max.y &&
      a.max.y > b.min.y &&
      a.min.z < b.max.z &&
      a.max.z > b.min.z
    );
  }

  /**
   * Sweep AABB along velocity vector and resolve collisions
   * Returns final position, whether player is on ground, and the block ID beneath the player
   */
  static sweepAABB(
    chunks: Map<string, any>,
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    width: number,
    height: number
  ): { position: THREE.Vector3; onGround: boolean; velocity: THREE.Vector3; groundBlockId: number } {
    const newPos = position.clone().add(velocity);
    const finalVelocity = velocity.clone();
    let onGround = false;
    let groundBlockId = 0;

    // Check if we can move to new position
    const playerAABB = this.createAABB(newPos.x, newPos.y, newPos.z, width, height);
    const collisionBlocks = this.getCollisionBlocks(chunks, playerAABB);

    // If no collisions, move freely
    if (collisionBlocks.length === 0) {
      return { position: newPos, onGround: false, velocity: finalVelocity, groundBlockId: 0 };
    }

    // Simple collision resolution: move axis by axis
    const result = position.clone();

    // Try X movement
    if (velocity.x !== 0) {
      const testX = position.clone();
      testX.x += velocity.x;
      const aabbX = this.createAABB(testX.x, testX.y, testX.z, width, height);
      const blocksX = this.getCollisionBlocks(chunks, aabbX);
      if (blocksX.length === 0) {
        result.x = testX.x;
      } else {
        finalVelocity.x = 0;
      }
    }

    // Try Y movement
    if (velocity.y !== 0) {
      const testY = result.clone();
      testY.y += velocity.y;
      const aabbY = this.createAABB(testY.x, testY.y, testY.z, width, height);
      const blocksY = this.getCollisionBlocks(chunks, aabbY);
      if (blocksY.length === 0) {
        result.y = testY.y;
      } else {
        finalVelocity.y = 0;
        if (velocity.y < 0) {
          onGround = true;
        }
      }
    }

    // Try Z movement
    if (velocity.z !== 0) {
      const testZ = result.clone();
      testZ.z += velocity.z;
      const aabbZ = this.createAABB(testZ.x, testZ.y, testZ.z, width, height);
      const blocksZ = this.getCollisionBlocks(chunks, aabbZ);
      if (blocksZ.length === 0) {
        result.z = testZ.z;
      } else {
        finalVelocity.z = 0;
      }
    }

    // Get the block ID beneath the player (for friction)
    if (onGround) {
      groundBlockId = this.getBlockAt(
        chunks,
        Math.floor(result.x),
        Math.floor(result.y - 0.1), // Slightly below feet
        Math.floor(result.z)
      );
    }

    return { position: result, onGround, velocity: finalVelocity, groundBlockId };
  }
}
