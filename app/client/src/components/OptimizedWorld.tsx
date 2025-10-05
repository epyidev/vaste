/**
 * OptimizedWorld.tsx - Optimized world rendering for cubic chunks
 * Uses ChunkManager for mesh generation and Three.js for rendering
 */

import { useEffect, useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ChunkManager } from "../ChunkManager";
import { ChunkData, ChunkKey, ChunkCoords, CHUNK_SIZE } from "../types";
import { logger } from "../utils/logger";

interface OptimizedWorldProps {
  chunks: Map<string, ChunkData>;
  playerPosition: { x: number; y: number; z: number };
  renderDistance: { horizontal: number; vertical: number };
  textureAtlas?: THREE.Texture;
}

export function OptimizedWorld({
  chunks,
  playerPosition,
  renderDistance,
  textureAtlas,
}: OptimizedWorldProps) {
  const chunkManagerRef = useRef<ChunkManager>(new ChunkManager());
  const [chunkMeshes, setChunkMeshes] = useState<Map<string, THREE.BufferGeometry>>(new Map());
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Create default material if no texture atlas provided
  useEffect(() => {
    if (!materialRef.current) {
      materialRef.current = new THREE.MeshStandardMaterial({
        color: 0x88cc88,
        vertexColors: false,
        roughness: 0.8,
        metalness: 0.2,
      });
    }

    if (textureAtlas && materialRef.current) {
      materialRef.current.map = textureAtlas;
      materialRef.current.needsUpdate = true;
    }

    return () => {
      if (materialRef.current) {
        materialRef.current.dispose();
      }
    };
  }, [textureAtlas]);

  // Update chunk manager when chunks change
  useEffect(() => {
    const manager = chunkManagerRef.current;

    // Add/update all chunks
    chunks.forEach((chunkData, chunkKey) => {
      manager.setChunk(chunkData);
    });

    // Remove chunks that are no longer in the map
    const managerChunks = manager.getAllChunks();
    managerChunks.forEach((_, chunkKey) => {
      if (!chunks.has(chunkKey)) {
        const { cx, cy, cz } = ChunkKey.fromString(chunkKey);
        manager.removeChunk(cx, cy, cz);
      }
    });
  }, [chunks]);

  // Generate meshes for visible chunks
  useEffect(() => {
    const manager = chunkManagerRef.current;
    const playerChunk = ChunkCoords.worldToChunk(
      playerPosition.x,
      playerPosition.y,
      playerPosition.z
    );

    const visibleChunks = new Set<string>();

    // Determine which chunks should be visible
    for (
      let cx = playerChunk.cx - renderDistance.horizontal;
      cx <= playerChunk.cx + renderDistance.horizontal;
      cx++
    ) {
      for (
        let cy = playerChunk.cy - renderDistance.vertical;
        cy <= playerChunk.cy + renderDistance.vertical;
        cy++
      ) {
        for (
          let cz = playerChunk.cz - renderDistance.horizontal;
          cz <= playerChunk.cz + renderDistance.horizontal;
          cz++
        ) {
          const chunkKey = ChunkKey.toString(cx, cy, cz);
          
          if (chunks.has(chunkKey)) {
            visibleChunks.add(chunkKey);

            // Request mesh generation if not available
            if (!manager.hasMesh(cx, cy, cz)) {
              manager.requestMesh(cx, cy, cz, (mesh) => {
                // Create Three.js geometry
                const geometry = new THREE.BufferGeometry();
                
                geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
                geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
                geometry.setAttribute("uv", new THREE.BufferAttribute(mesh.uvs, 2));
                geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
                
                geometry.computeBoundingSphere();

                // Update state
                setChunkMeshes((prev) => {
                  const updated = new Map(prev);
                  updated.set(chunkKey, geometry);
                  return updated;
                });
              });
            }
          }
        }
      }
    }

    // Remove meshes for chunks that are no longer visible
    setChunkMeshes((prev) => {
      const updated = new Map(prev);
      let changed = false;

      prev.forEach((_, chunkKey) => {
        if (!visibleChunks.has(chunkKey)) {
          const geometry = updated.get(chunkKey);
          if (geometry) {
            geometry.dispose();
          }
          updated.delete(chunkKey);
          changed = true;
        }
      });

      return changed ? updated : prev;
    });
  }, [chunks, playerPosition, renderDistance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Dispose all geometries
      chunkMeshes.forEach((geometry) => {
        geometry.dispose();
      });

      // Dispose chunk manager
      chunkManagerRef.current.dispose();
    };
  }, []);

  // Log stats periodically
  useFrame(() => {
    // Log every 60 frames (~1 second at 60fps)
    if (Math.random() < 0.016) {
      const stats = chunkManagerRef.current.getStats();
      logger.debug(
        `[OptimizedWorld] Chunks: ${stats.chunkCount}, Meshes: ${stats.meshCount}, Queue: ${stats.queueLength}`
      );
    }
  });

  return (
    <group>
      {Array.from(chunkMeshes.entries()).map(([chunkKey, geometry]) => {
        const { cx, cy, cz } = ChunkKey.fromString(chunkKey);
        const worldPos = ChunkCoords.localToWorld(cx, cy, cz, 0, 0, 0);

        return (
          <mesh
            key={chunkKey}
            name={`chunk-${chunkKey}`}
            position={[worldPos.x, worldPos.y, worldPos.z]}
            geometry={geometry}
            material={materialRef.current!}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
}
