import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockOutline } from './BlockOutline';

export const BlockSelector: React.FC = () => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const [targetBlock, setTargetBlock] = useState<[number, number, number] | null>(null);

  useFrame(() => {
    // Limit raycast distance to 7 blocks
    raycaster.current.far = 7;
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Get all chunk meshes
    const chunkMeshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith('chunk-')) {
        chunkMeshes.push(obj);
      }
    });

    if (chunkMeshes.length === 0) {
      setTargetBlock(null);
      return;
    }

    const intersects = raycaster.current.intersectObjects(chunkMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      
      // Get the hit point in world space
      const hitPoint = hit.point;
      
      // Get the face normal - DON'T transform it, use it directly
      const normal = hit.face!.normal.clone();
      
      // The normal points inward (e.g., (0,-1,0) for top face pointing down into the block)
      // So we ADD the normal scaled by epsilon to go into the block
      const epsilon = 0.1;
      const adjustedPoint = hitPoint.clone().add(normal.multiplyScalar(epsilon));
      
      // Blocks are rendered with their corners at integer positions
      // but they span from (x,y,z) to (x+1,y+1,z+1)
      // So we just floor the adjusted point to get the block coordinates
      const blockX = Math.floor(adjustedPoint.x);
      const blockY = Math.floor(adjustedPoint.y);
      const blockZ = Math.floor(adjustedPoint.z);

      setTargetBlock([blockX, blockY, blockZ]);
    } else {
      setTargetBlock(null);
    }
  });

  return targetBlock ? <BlockOutline position={targetBlock} /> : null;
};

export default BlockSelector;
