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

  /**
   * Check if movement along X axis would cause player to fall off edge
   * Returns true if the movement should be blocked to prevent falling
   * 
   * This implementation checks if the player's hitbox would have ANY solid ground
   * support after the movement. It allows the player to get as close to the edge
   * as physically possible (even 1 pixel of hitbox overlap is enough).
   * 
   * @param chunks - World chunk data
   * @param currentPos - Current player feet position
   * @param deltaX - Intended X movement this frame
   * @param width - Player hitbox width
   * @param height - Player hitbox height
   * @returns true if movement would cause player to fall off edge
   */
  static wouldFallOffEdgeX(
    chunks: Map<string, any>,
    currentPos: THREE.Vector3,
    deltaX: number,
    width: number,
    height: number
  ): boolean {
    if (deltaX === 0) return false;

    const halfWidth = width / 2;
    const newX = currentPos.x + deltaX;
    
    // Calculate the full range of the player's hitbox after movement
    const minX = newX - halfWidth;
    const maxX = newX + halfWidth;
    const minZ = currentPos.z - halfWidth;
    const maxZ = currentPos.z + halfWidth;
    
    // Get all block positions that could potentially support the player
    const blockMinX = Math.floor(minX);
    const blockMaxX = Math.floor(maxX);
    const blockMinZ = Math.floor(minZ);
    const blockMaxZ = Math.floor(maxZ);
    const blockY = Math.floor(currentPos.y - 0.01); // Just below feet
    
    // Check if ANY block exists under the player's hitbox area
    for (let bx = blockMinX; bx <= blockMaxX; bx++) {
      for (let bz = blockMinZ; bz <= blockMaxZ; bz++) {
        // Check if this block position intersects with player's hitbox
        const blockMinBoundX = bx;
        const blockMaxBoundX = bx + 1;
        const blockMinBoundZ = bz;
        const blockMaxBoundZ = bz + 1;
        
        // AABB intersection test
        const intersects = !(
          maxX <= blockMinBoundX ||
          minX >= blockMaxBoundX ||
          maxZ <= blockMinBoundZ ||
          minZ >= blockMaxBoundZ
        );
        
        if (intersects && this.isBlockSolid(chunks, bx, blockY, bz)) {
          return false; // Found ground support, safe to move
        }
      }
    }
    
    return true; // No ground support found, would fall
  }

  /**
   * Check if movement along Z axis would cause player to fall off edge
   * Returns true if the movement should be blocked to prevent falling
   * 
   * This implementation checks if the player's hitbox would have ANY solid ground
   * support after the movement. It allows the player to get as close to the edge
   * as physically possible (even 1 pixel of hitbox overlap is enough).
   * 
   * @param chunks - World chunk data
   * @param currentPos - Current player feet position
   * @param deltaZ - Intended Z movement this frame
   * @param width - Player hitbox width
   * @param height - Player hitbox height
   * @returns true if movement would cause player to fall off edge
   */
  static wouldFallOffEdgeZ(
    chunks: Map<string, any>,
    currentPos: THREE.Vector3,
    deltaZ: number,
    width: number,
    height: number
  ): boolean {
    if (deltaZ === 0) return false;

    const halfWidth = width / 2;
    const newZ = currentPos.z + deltaZ;
    
    // Calculate the full range of the player's hitbox after movement
    const minX = currentPos.x - halfWidth;
    const maxX = currentPos.x + halfWidth;
    const minZ = newZ - halfWidth;
    const maxZ = newZ + halfWidth;
    
    // Get all block positions that could potentially support the player
    const blockMinX = Math.floor(minX);
    const blockMaxX = Math.floor(maxX);
    const blockMinZ = Math.floor(minZ);
    const blockMaxZ = Math.floor(maxZ);
    const blockY = Math.floor(currentPos.y - 0.01); // Just below feet
    
    // Check if ANY block exists under the player's hitbox area
    for (let bx = blockMinX; bx <= blockMaxX; bx++) {
      for (let bz = blockMinZ; bz <= blockMaxZ; bz++) {
        // Check if this block position intersects with player's hitbox
        const blockMinBoundX = bx;
        const blockMaxBoundX = bx + 1;
        const blockMinBoundZ = bz;
        const blockMaxBoundZ = bz + 1;
        
        
        // AABB intersection test
        const intersects = !(
          maxX <= blockMinBoundX ||
          minX >= blockMaxBoundX ||
          maxZ <= blockMinBoundZ ||
          minZ >= blockMaxBoundZ
        );
        
        if (intersects && this.isBlockSolid(chunks, bx, blockY, bz)) {
          return false; // Found ground support, safe to move
        }
      }
    }
    
    return true; // No ground support found, would fall
  }

  /**
   * Calculate how close the player is to falling off an edge
   * Returns a value between 0 and 1:
   * - 0: Fully supported (center of block)
   * - 1: At the very edge, about to fall
   * 
   * This is used for smooth speed reduction when sneaking at edges.
   * 
   * @param chunks - World chunk data
   * @param position - Current player feet position
   * @param width - Player hitbox width
   * @returns Edge proximity factor (0 = safe, 1 = very close to edge)
   */
  static getEdgeProximity(
    chunks: Map<string, any>,
    position: THREE.Vector3,
    width: number
  ): number {
    const halfWidth = width / 2;
    
    // Calculate player's hitbox bounds
    const minX = position.x - halfWidth;
    const maxX = position.x + halfWidth;
    const minZ = position.z - halfWidth;
    const maxZ = position.z + halfWidth;
    
    // Get all block positions under the player
    const blockMinX = Math.floor(minX);
    const blockMaxX = Math.floor(maxX);
    const blockMinZ = Math.floor(minZ);
    const blockMaxZ = Math.floor(maxZ);
    const blockY = Math.floor(position.y - 0.01);
    
    // Calculate total hitbox area
    const hitboxArea = width * width;
    
    // Calculate area of hitbox that has solid ground below
    let supportedArea = 0;
    
    for (let bx = blockMinX; bx <= blockMaxX; bx++) {
      for (let bz = blockMinZ; bz <= blockMaxZ; bz++) {
        if (this.isBlockSolid(chunks, bx, blockY, bz)) {
          // Calculate intersection area between hitbox and this block
          const blockMinBoundX = bx;
          const blockMaxBoundX = bx + 1;
          const blockMinBoundZ = bz;
          const blockMaxBoundZ = bz + 1;
          
          const intersectMinX = Math.max(minX, blockMinBoundX);
          const intersectMaxX = Math.min(maxX, blockMaxBoundX);
          const intersectMinZ = Math.max(minZ, blockMinBoundZ);
          const intersectMaxZ = Math.min(maxZ, blockMaxBoundZ);
          
          if (intersectMaxX > intersectMinX && intersectMaxZ > intersectMinZ) {
            const intersectArea = (intersectMaxX - intersectMinX) * (intersectMaxZ - intersectMinZ);
            supportedArea += intersectArea;
          }
        }
      }
    }
    
    // Calculate unsupported ratio (0 = fully supported, 1 = no support)
    const unsupportedRatio = 1 - (supportedArea / hitboxArea);
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, unsupportedRatio));
  }

  /**
   * Check if player is currently standing at a block edge
   * This is used to slow down movement for better control at edges
   * 
   * @param chunks - World chunk data
   * @param position - Current player feet position
   * @param width - Player hitbox width
   * @returns true if player is at an edge
   */
  static isAtEdge(
    chunks: Map<string, any>,
    position: THREE.Vector3,
    width: number
  ): boolean {
    const proximity = this.getEdgeProximity(chunks, position, width);
    return proximity > 0.1; // At edge if more than 10% unsupported
  }
}

