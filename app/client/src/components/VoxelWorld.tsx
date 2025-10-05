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
}

export function VoxelWorld({ chunks, ambientOcclusionEnabled = false }: VoxelWorldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const managerRef = useRef<ChunkManager | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      console.log('[VoxelWorld] Initializing texture system...');
      await textureManager.initialize();
      const texture = textureManager.getTexture();
      
      if (!texture) {
        console.error('[VoxelWorld] Failed to get atlas texture');
        managerRef.current = new ChunkManager(undefined, ambientOcclusionEnabled);
      } else {
        console.log('[VoxelWorld] Atlas texture ready');
        managerRef.current = new ChunkManager(texture, ambientOcclusionEnabled);
      }
      
      setReady(true);
    };

    init().catch((error) => {
      console.error('[VoxelWorld] Initialization error:', error);
      managerRef.current = new ChunkManager(undefined, ambientOcclusionEnabled);
      setReady(true);
    });

    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
      }
    };
  }, [ambientOcclusionEnabled]); // Recréer le manager quand AO change

  useEffect(() => {
    if (!ready || !managerRef.current || !groupRef.current) return;

    const manager = managerRef.current;
    const group = groupRef.current;
    const existingKeys = new Set<string>();

    group.children.forEach(child => {
      if (child.userData.chunkKey) {
        existingKeys.add(child.userData.chunkKey);
      }
    });

    for (const key of existingKeys) {
      if (!chunks.has(key)) {
        const [cx, cy, cz] = key.split(',').map(Number);
        const child = group.children.find(c => c.userData.chunkKey === key);
        if (child) group.remove(child);
        manager.removeMesh(cx, cy, cz);
      }
    }

    const chunkArray = Array.from(chunks.values());
    const batchSize = 10;
    let index = 0;

    const processBatch = () => {
      const end = Math.min(index + batchSize, chunkArray.length);
      
      for (let i = index; i < end; i++) {
        const chunk = chunkArray[i];
        const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
        
        if (existingKeys.has(key)) continue;

        const mesh = manager.getOrCreateMesh({
          cx: chunk.cx,
          cy: chunk.cy,
          cz: chunk.cz,
          blocks: chunk.blocksArray,
          version: chunk.version
        });

        if (mesh) {
          mesh.userData.chunkKey = key;
          group.add(mesh);
        }
      }

      index = end;
      if (index < chunkArray.length) {
        requestAnimationFrame(processBatch);
      }
    };

    processBatch();
  }, [chunks, ready]);

  if (!ready) {
    return null;
  }

  return <group ref={groupRef} />;
}
