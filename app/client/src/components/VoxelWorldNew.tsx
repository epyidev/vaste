/**
 * VoxelWorldNew.tsx - Professional voxel world rendering component
 * Features:
 * - Optimized chunk rendering with frustum culling
 * - Efficient memory management
 * - Incremental updates without freezes
 * - Proper texture atlas support
 */

import { useEffect, useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ChunkData } from '../types';
import { ChunkRenderer } from '../voxel/ChunkRenderer';
import { TextureAtlasBuilder, BlockTextureDef } from '../voxel/TextureAtlasBuilder';
import { BlockTextureMapping } from '../voxel/MeshBuilder';
import { logger } from '../utils/logger';

interface VoxelWorldProps {
  chunks: Map<string, ChunkData>;
  playerPosition?: { x: number; y: number; z: number };
  renderDistance?: number;
  onStatsUpdate?: (stats: { chunksLoaded: number; totalVertices: number; totalTriangles: number }) => void;
}

export function VoxelWorldNew({ 
  chunks, 
  playerPosition = { x: 0, y: 0, z: 0 },
  renderDistance = 256,
  onStatsUpdate
}: VoxelWorldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const chunkRendererRef = useRef<ChunkRenderer | null>(null);
  const [isAtlasReady, setIsAtlasReady] = useState(false);
  const [stats, setStats] = useState({ chunksLoaded: 0, totalVertices: 0, totalTriangles: 0 });

  // Initialize texture atlas and chunk renderer
  useEffect(() => {
    console.log('🚀 [VoxelWorld] useEffect triggered - Starting initialization');
    
    const initAtlas = async () => {
      try {
        console.log('🎨 [VoxelWorld] Initializing texture atlas...');
        const builder = new TextureAtlasBuilder();
        
        console.log('📦 [VoxelWorld] Calling buildDefaultAtlas()...');
        const atlasResult = await builder.buildDefaultAtlas();
        
        console.log('✅ [VoxelWorld] Atlas result received:', atlasResult);
        console.log('🔧 [VoxelWorld] Creating chunk renderer...');
        chunkRendererRef.current = new ChunkRenderer(
          atlasResult.texture,
          atlasResult.mapping
        );
        
        setIsAtlasReady(true);
        console.log('✅ [VoxelWorld] Voxel world initialized successfully');
      } catch (err) {
        console.error('❌ [VoxelWorld] Failed to initialize voxel world:', err);
        console.error('❌ [VoxelWorld] Error stack:', err instanceof Error ? err.stack : 'No stack');
        
        // Fallback: create renderer without atlas (will use colored materials)
        console.warn('⚠️ [VoxelWorld] Using fallback renderer without textures');
        chunkRendererRef.current = new ChunkRenderer();
        setIsAtlasReady(true);
      }
    };

    initAtlas();

    // Cleanup on unmount
    return () => {
      if (chunkRendererRef.current) {
        chunkRendererRef.current.dispose();
        chunkRendererRef.current = null;
      }
    };
  }, []);

  // Update chunk meshes when chunks change
  useEffect(() => {
    if (!isAtlasReady || !chunkRendererRef.current || !groupRef.current) {
      console.log(`⏸️ [VoxelWorld] Waiting for initialization... (atlasReady: ${isAtlasReady}, renderer: ${!!chunkRendererRef.current}, group: ${!!groupRef.current})`);
      return;
    }

    const renderer = chunkRendererRef.current;
    const group = groupRef.current;

    // Process chunks incrementally to avoid freezes
    const chunkKeys = Array.from(chunks.keys());
    const existingKeys = new Set(renderer.getAllMeshes().map(m => m.userData.chunkKey));

    console.log(`🔄 [VoxelWorld] Processing ${chunkKeys.length} chunks (${existingKeys.size} already rendered)`);

    // Remove chunks that no longer exist
    for (const key of existingKeys) {
      if (!chunks.has(key)) {
        const [cx, cy, cz] = key.split(',').map(Number);
        const mesh = renderer.getChunkMesh(cx, cy, cz);
        if (mesh) {
          group.remove(mesh);
        }
        renderer.removeChunk(cx, cy, cz);
      }
    }

    // Add/update chunks (process in batches to avoid freezing)
    const batchSize = 10;
    let processed = 0;

    const processBatch = () => {
      const batch = chunkKeys.slice(processed, processed + batchSize);
      
      for (const key of batch) {
        const chunk = chunks.get(key)!;
        
        // Convert ChunkData to BlockData format
        const blockData = {
          blocks: chunk.blocksArray,
          cx: chunk.cx,
          cy: chunk.cy,
          cz: chunk.cz,
        };

        // Check if chunk already rendered
        const existingMesh = renderer.getChunkMesh(chunk.cx, chunk.cy, chunk.cz);
        
        if (!existingMesh) {
          // Create new mesh
          const mesh = renderer.getOrCreateChunkMesh(blockData);
          if (mesh) {
            mesh.userData.chunkKey = key;
            group.add(mesh);
          }
        } else if (chunk.version && existingMesh.userData.version !== chunk.version) {
          // Update existing mesh if version changed
          group.remove(existingMesh);
          const newMesh = renderer.updateChunkMesh(blockData);
          if (newMesh) {
            newMesh.userData.chunkKey = key;
            newMesh.userData.version = chunk.version;
            group.add(newMesh);
          }
        }
      }

      processed += batchSize;

      if (processed < chunkKeys.length) {
        // Process next batch on next frame
        requestAnimationFrame(processBatch);
      } else {
        // Update stats when done
        if (renderer) {
          const stats = renderer.getStats();
          setStats(stats);
          console.log(`📊 [VoxelWorld] Rendering complete: ${stats.chunksLoaded} chunks, ${stats.totalVertices} vertices, ${stats.totalTriangles} triangles`);
        }
      }
    };

    processBatch();

  }, [chunks, isAtlasReady]);

  // Expose renderer for debugging (can be removed in production)
  useEffect(() => {
    if (chunkRendererRef.current && typeof window !== 'undefined') {
      (window as any).__voxelRenderer = chunkRendererRef.current;
      console.log('🔍 [VoxelWorld] Renderer exposed on window.__voxelRenderer for debugging');
    }
  }, [isAtlasReady]);

  // Update stats periodically
  useFrame(() => {
    if (chunkRendererRef.current) {
      // Update stats every 60 frames (~1 second at 60fps)
      if (Math.random() < 0.016) {
        const newStats = chunkRendererRef.current.getStats();
        setStats(newStats);
        if (onStatsUpdate) {
          onStatsUpdate(newStats);
        }
      }
    }
  });

  // Render loading state
  if (!isAtlasReady) {
    return (
      <group>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      </group>
    );
  }

  return (
    <>
      <group ref={groupRef} />
      
      {/* Debug stats (optional - can be removed) */}
      {stats.chunksLoaded > 0 && (
        <mesh position={[0, 100, 0]} visible={false}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#00ff00" />
        </mesh>
      )}
    </>
  );
}
