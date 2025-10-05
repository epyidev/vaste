import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { textureAtlas } from "../utils/TextureAtlasManager";
import { blockMapping } from "../data/BlockRegistry";

interface VoxelWorldProps {
  chunks: Map<string, any>;
  controlsRef: React.RefObject<any>;
}

interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  blockType: number;
}

interface GeneratedMesh {
  chunkKey: string;
  meshes: MeshData[];
}

const CHUNK_SIZE = 16;

export function VoxelWorld({ chunks, controlsRef }: VoxelWorldProps) {
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const [generatedMeshes, setGeneratedMeshes] = useState<Map<string, MeshData[]>>(new Map());
  
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRequestsRef = useRef<Map<number, string>>(new Map());

  // Initialize worker
  useEffect(() => {
    console.log("[VoxelWorld] Initializing mesh generator worker...");
    
    const worker = new Worker(
      new URL("../workers/meshGeneratorWorker.ts", import.meta.url),
      { type: "module" }
    );

    // Handle worker messages
    worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data;

      if (type === 'mappingLoaded') {
        console.log("[VoxelWorld] Worker mapping loaded");
        return;
      }

      if (type === 'meshGenerated') {
        const { requestId, chunkKey, meshes } = e.data as {
          requestId: number;
          chunkKey: string;
          meshes: MeshData[];
        };

        pendingRequestsRef.current.delete(requestId);
        
        setGeneratedMeshes(prev => {
          const next = new Map(prev);
          next.set(chunkKey, meshes);
          return next;
        });

        console.log(`[VoxelWorld] Received ${meshes.length} meshes for chunk ${chunkKey}`);
      }

      if (type === 'error') {
        console.error('[VoxelWorld] Worker error:', e.data.error);
        pendingRequestsRef.current.delete(e.data.requestId);
      }
    };

    worker.onerror = (error) => {
      console.error('[VoxelWorld] Worker error:', error);
    };

    workerRef.current = worker;

    // Send block mapping to worker
    worker.postMessage({
      type: 'loadMapping',
      mappings: blockMapping.exportMappingTable()
    });

    return () => {
      worker.terminate();
      console.log("[VoxelWorld] Worker terminated");
    };
  }, []);

  // Preload textures
  useEffect(() => {
    console.log("[VoxelWorld] Loading blockpack textures...");
    textureAtlas.preloadBlockpacks().then(() => {
      console.log("[VoxelWorld] Textures loaded!");
      setTexturesLoaded(true);
    });

    return () => {
      textureAtlas.dispose();
    };
  }, []);

  // Generate meshes for new chunks
  useEffect(() => {
    if (!workerRef.current || !texturesLoaded) return;

    chunks.forEach((chunkData, key) => {
      // Skip if already generated or pending
      if (generatedMeshes.has(key)) return;
      if (Array.from(pendingRequestsRef.current.values()).includes(key)) return;

      // Skip if no blocks
      if (!chunkData.blocksArray || chunkData.blocksArray.length === 0) return;

      // Request mesh generation
      const requestId = requestIdRef.current++;
      pendingRequestsRef.current.set(requestId, key);

      // Collect neighbor chunks for face culling
      const neighborChunks: { [key: string]: number[] } = {};
      const { cx, cy, cz } = chunkData;

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            
            const neighborKey = `${cx + dx},${cy + dy},${cz + dz}`;
            const neighbor = chunks.get(neighborKey);
            
            if (neighbor && neighbor.blocksArray) {
              neighborChunks[neighborKey] = Array.from(neighbor.blocksArray);
            }
          }
        }
      }

      workerRef.current!.postMessage({
        type: 'generate',
        requestId,
        chunk: {
          cx: chunkData.cx,
          cy: chunkData.cy,
          cz: chunkData.cz,
          blocksArray: chunkData.blocksArray
        },
        neighborChunks
      });

      console.log(`[VoxelWorld] Requested mesh generation for chunk ${key}`);
    });

    // Clean up old meshes for chunks that no longer exist
    setGeneratedMeshes(prev => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!chunks.has(key)) {
          console.log(`[VoxelWorld] Removing mesh for unloaded chunk ${key}`);
          next.delete(key);
        }
      }
      return next;
    });
  }, [chunks, texturesLoaded, generatedMeshes]);

  if (!texturesLoaded) {
    return null;
  }

  console.log(`[VoxelWorld] Rendering ${generatedMeshes.size}/${chunks.size} chunks`);

  return (
    <>
      {Array.from(generatedMeshes.entries()).map(([key, meshes]) => (
        <VoxelChunkMeshes key={key} chunkKey={key} meshes={meshes} />
      ))}
    </>
  );
}

interface VoxelChunkMeshesProps {
  chunkKey: string;
  meshes: MeshData[];
}

function VoxelChunkMeshes({ chunkKey, meshes }: VoxelChunkMeshesProps) {
  return (
    <>
      {meshes.map((meshData, index) => {
        // Create geometry from worker data
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2));
        geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

        // Get material for this block type
        const material = textureAtlas.getMaterialForBlock(meshData.blockType);

        return (
          <mesh
            key={`${chunkKey}-${meshData.blockType}-${index}`}
            geometry={geometry}
            material={material}
            castShadow
            receiveShadow
          />
        );
      })}
    </>
  );
}
