/**
 * types.ts - Type definitions for the World System
 */

export const CHUNK_SIZE = 16;
export const REGION_SIZE = 32; // 32x32x32 chunks per region

/**
 * Message types for binary protocol
 */
export enum MessageType {
  WORLD_ASSIGN = 1,
  CHUNK_DATA = 2,
  CHUNK_UPDATE = 3,
  PLAYER_JOIN = 4,
  PLAYER_LEAVE = 5,
  PLAYER_MOVE = 6,
}

/**
 * Block type definition
 */
export interface Block {
  x: number;
  y: number;
  z: number;
  type: number;
}

/**
 * Chunk data structure
 */
export interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  version: number;
  blocks: Block[];
  blocksArray: Uint16Array;
}

/**
 * World assignment message
 */
export interface WorldAssignMessage {
  type: "world_assign";
  generatorType: string;
  spawnPoint: {
    x: number;
    y: number;
    z: number;
  };
}

/**
 * Player data
 */
export interface PlayerData {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Client to server messages
 */
export type ClientMessage =
  | { type: "auth_info"; username: string; uuid: string; token: string }
  | { type: "player_move"; x: number; y: number; z: number }
  | { type: "block_place"; x: number; y: number; z: number; blockType: number }
  | { type: "block_break"; x: number; y: number; z: number }
  | { type: "chunk_request"; cx: number; cy: number; cz: number };

/**
 * Server to client messages
 */
export type ServerMessage =
  | WorldAssignMessage
  | { type: "player_joined"; id: string; username: string; x: number; y: number; z: number }
  | { type: "player_left"; id: string }
  | { type: "player_move"; id: string; x: number; y: number; z: number }
  | { type: "error"; code: string; message: string };

/**
 * Block types (default blocks)
 */
export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WOOD = 5,
}

/**
 * Chunk mesh data for rendering
 */
export interface ChunkMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  blockTypes: Uint16Array;
}

/**
 * Chunk key utilities
 */
export class ChunkKey {
  static toString(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  static fromString(key: string): { cx: number; cy: number; cz: number } {
    const [cx, cy, cz] = key.split(",").map(Number);
    return { cx, cy, cz };
  }

  static fromWorldCoords(x: number, y: number, z: number): string {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return ChunkKey.toString(cx, cy, cz);
  }
}

/**
 * Local coordinates within a chunk
 */
export interface LocalCoords {
  x: number;
  y: number;
  z: number;
}

/**
 * Chunk coordinates utilities
 */
export class ChunkCoords {
  /**
   * Convert world coordinates to chunk coordinates
   */
  static worldToChunk(x: number, y: number, z: number): { cx: number; cy: number; cz: number } {
    return {
      cx: Math.floor(x / CHUNK_SIZE),
      cy: Math.floor(y / CHUNK_SIZE),
      cz: Math.floor(z / CHUNK_SIZE),
    };
  }

  /**
   * Convert world coordinates to local chunk coordinates
   */
  static worldToLocal(x: number, y: number, z: number): LocalCoords {
    return {
      x: ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
      y: ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
      z: ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    };
  }

  /**
   * Convert local chunk coordinates to world coordinates
   */
  static localToWorld(
    cx: number,
    cy: number,
    cz: number,
    localX: number,
    localY: number,
    localZ: number
  ): { x: number; y: number; z: number } {
    return {
      x: cx * CHUNK_SIZE + localX,
      y: cy * CHUNK_SIZE + localY,
      z: cz * CHUNK_SIZE + localZ,
    };
  }

  /**
   * Get block index in chunk's linear array
   */
  static getBlockIndex(localX: number, localY: number, localZ: number): number {
    return (localY * CHUNK_SIZE * CHUNK_SIZE) + (localZ * CHUNK_SIZE) + localX;
  }
}

/**
 * Render distance configuration
 */
export interface RenderConfig {
  horizontalDistance: number; // Chunks in X/Z directions
  verticalDistance: number; // Chunks in Y direction
}

/**
 * Default render configuration
 */
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  horizontalDistance: 8,
  verticalDistance: 4,
};

/**
 * Face directions for mesh generation
 */
export enum FaceDirection {
  TOP = 0,
  BOTTOM = 1,
  NORTH = 2,
  SOUTH = 3,
  EAST = 4,
  WEST = 5,
}

/**
 * Face normal vectors
 */
export const FACE_NORMALS: Record<FaceDirection, [number, number, number]> = {
  [FaceDirection.TOP]: [0, 1, 0],
  [FaceDirection.BOTTOM]: [0, -1, 0],
  [FaceDirection.NORTH]: [0, 0, -1],
  [FaceDirection.SOUTH]: [0, 0, 1],
  [FaceDirection.EAST]: [1, 0, 0],
  [FaceDirection.WEST]: [-1, 0, 0],
};

/**
 * Face vertices (local coordinates within a block)
 */
export const FACE_VERTICES: Record<FaceDirection, number[][]> = {
  [FaceDirection.TOP]: [
    [0, 1, 0],
    [1, 1, 0],
    [1, 1, 1],
    [0, 1, 1],
  ],
  [FaceDirection.BOTTOM]: [
    [0, 0, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 0, 0],
  ],
  [FaceDirection.NORTH]: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ],
  [FaceDirection.SOUTH]: [
    [0, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
    [1, 0, 1],
  ],
  [FaceDirection.EAST]: [
    [1, 0, 0],
    [1, 0, 1],
    [1, 1, 1],
    [1, 1, 0],
  ],
  [FaceDirection.WEST]: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 1, 1],
    [0, 0, 1],
  ],
};

/**
 * Face UVs for texture mapping
 */
export const FACE_UVS: number[][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
