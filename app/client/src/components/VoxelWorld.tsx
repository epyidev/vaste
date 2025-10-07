import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ChunkManager } from '../rendering/chunks/ChunkManager';
import { textureManager } from '../rendering/textures/TextureManager';

interface ChunkData {
  cx: number;
  cy: number;
  cz: number;
  blocksArray: Uint16Array;
  version?: number;
}

interface VoxelWorldProps {
  chunks: Map<string, ChunkData>;
  ambientOcclusionEnabled?: boolean;
  shadowsEnabled?: boolean;
  blockpacksReady?: boolean;
}

export function VoxelWorld({ chunks, ambientOcclusionEnabled = true, shadowsEnabled = true, blockpacksReady = false }: VoxelWorldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const managerRef = useRef<ChunkManager | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Wait for blockpacks to be loaded before initializing textures
      if (!blockpacksReady) {
        console.log('[VoxelWorld] Waiting for blockpacks to be loaded...');
        return;
      }

      console.log('[VoxelWorld] Blockpacks ready, initializing texture system...');
      
      // Blockpacks are now loaded by NetworkManager from server
      // Now we can initialize texture system
      await textureManager.initialize();
      const texture = textureManager.getTexture();
      
      if (!texture) {
        console.error('[VoxelWorld] Failed to get atlas texture');
        managerRef.current = new ChunkManager(undefined, ambientOcclusionEnabled, shadowsEnabled);
      } else {
        console.log('[VoxelWorld] Atlas texture ready');
        managerRef.current = new ChunkManager(texture, ambientOcclusionEnabled, shadowsEnabled);
      }
      
      setReady(true);
    };

    init().catch((error) => {
      console.error('[VoxelWorld] Initialization error:', error);
      managerRef.current = new ChunkManager(undefined, ambientOcclusionEnabled, shadowsEnabled);
      setReady(true);
    });

    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
      }
    };
  }, [ambientOcclusionEnabled, blockpacksReady]); // Re-initialize when blockpacks are ready

  // Mettre à jour les ombres sans recréer le manager
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateShadows(shadowsEnabled);
    }
  }, [shadowsEnabled]);

  useEffect(() => {
    if (!ready || !managerRef.current || !groupRef.current) return;

    const manager = managerRef.current;
    const group = groupRef.current;

    const currentKeys = new Set<string>();
    for (const chunk of chunks.values()) {
      currentKeys.add(`${chunk.cx},${chunk.cy},${chunk.cz}`);
    }

    const childrenToRemove: THREE.Object3D[] = [];
    for (const child of group.children) {
      const key = child.userData.chunkKey;
      if (key && !currentKeys.has(key)) {
        childrenToRemove.push(child);
      }
    }

    for (const child of childrenToRemove) {
      const key = child.userData.chunkKey;
      const [cx, cy, cz] = key.split(',').map(Number);
      group.remove(child);
      manager.removeMesh(cx, cy, cz);
    }

    for (const chunk of chunks.values()) {
      const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
      
      const existingChild = group.children.find(c => c.userData.chunkKey === key);
      
      if (existingChild && existingChild.userData.version === chunk.version) {
        continue;
      }

      if (existingChild) {
        group.remove(existingChild);
        manager.removeMesh(chunk.cx, chunk.cy, chunk.cz);
      }

      const mesh = manager.getOrCreateMesh({
        cx: chunk.cx,
        cy: chunk.cy,
        cz: chunk.cz,
        blocks: chunk.blocksArray,
        version: chunk.version
      });

      if (mesh) {
        mesh.userData.chunkKey = key;
        mesh.userData.version = chunk.version;
        mesh.name = `chunk-${key}`;
        group.add(mesh);
      }
    }
  }, [chunks, ready]);

  if (!ready) {
    return null;
  }

  return <group ref={groupRef} />;
}
