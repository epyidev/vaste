import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockOutline } from './BlockOutline';
import { NetworkManager } from '../network';
import { useBlockActions } from '../hooks/useBlockActions';
import { PHYSICS_CONFIG } from '../config/movement';

interface BlockSelectorProps {
  networkManager: NetworkManager | null;
  playerPosition: { x: number; y: number; z: number };
}

export const BlockSelector: React.FC<BlockSelectorProps> = ({ networkManager, playerPosition }) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const [targetBlock, setTargetBlock] = useState<[number, number, number] | null>(null);
  const [adjacentPosition, setAdjacentPosition] = useState<[number, number, number] | null>(null);
  
  const { breakBlock, placeBlock } = useBlockActions({ networkManager });

  // Check if a block position would collide with the player's AABB
  const wouldCollideWithPlayer = (blockPos: [number, number, number]): boolean => {
    const [bx, by, bz] = blockPos;
    
    // Use camera position directly (it's the eye position in real-time)
    const eyeX = camera.position.x;
    const eyeY = camera.position.y;
    const eyeZ = camera.position.z;
    
    // Calculate feet position
    const playerFeetY = eyeY - PHYSICS_CONFIG.playerEyeHeight;
    
    // Player AABB: centered at (eyeX, eyeZ) horizontally,
    // from playerFeetY to playerFeetY + height vertically
    const halfWidth = PHYSICS_CONFIG.playerWidth / 2;
    const playerMinX = eyeX - halfWidth;
    const playerMaxX = eyeX + halfWidth;
    const playerMinY = playerFeetY;
    const playerMaxY = playerFeetY + PHYSICS_CONFIG.playerHeight;
    const playerMinZ = eyeZ - halfWidth;
    const playerMaxZ = eyeZ + halfWidth;
    
    // Block AABB: 1x1x1 cube at integer coordinates
    const blockMinX = bx;
    const blockMaxX = bx + 1;
    const blockMinY = by;
    const blockMaxY = by + 1;
    const blockMinZ = bz;
    const blockMaxZ = bz + 1;
    
    // AABB intersection test (standard separating axis theorem)
    return (
      playerMinX < blockMaxX &&
      playerMaxX > blockMinX &&
      playerMinY < blockMaxY &&
      playerMaxY > blockMinY &&
      playerMinZ < blockMaxZ &&
      playerMaxZ > blockMinZ
    );
  };

  useFrame(() => {
    raycaster.current.far = 7;
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);

    const chunkMeshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith('chunk-')) {
        chunkMeshes.push(obj);
      }
    });

    if (chunkMeshes.length === 0) {
      setTargetBlock(null);
      setAdjacentPosition(null);
      return;
    }

    const intersects = raycaster.current.intersectObjects(chunkMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const hitPoint = hit.point.clone();
      const normal = hit.face!.normal.clone();

      const epsilon = 0.001;
      const insidePoint = hitPoint.add(normal.clone().multiplyScalar(-epsilon));
      
      const targetX = Math.floor(insidePoint.x);
      const targetY = Math.floor(insidePoint.y);
      const targetZ = Math.floor(insidePoint.z);

      setTargetBlock([targetX, targetY, targetZ]);

      const adjacentX = targetX + Math.round(normal.x);
      const adjacentY = targetY + Math.round(normal.y);
      const adjacentZ = targetZ + Math.round(normal.z);
      
      setAdjacentPosition([adjacentX, adjacentY, adjacentZ]);
    } else {
      setTargetBlock(null);
      setAdjacentPosition(null);
    }
  });

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!targetBlock) return;

      if (e.button === 0) {
        breakBlock(targetBlock);
      } else if (e.button === 2 && adjacentPosition) {
        e.preventDefault();
        
        // Check if placing the block would collide with player
        if (!wouldCollideWithPlayer(adjacentPosition)) {
          placeBlock(adjacentPosition);
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [targetBlock, adjacentPosition, breakBlock, placeBlock]);

  return targetBlock ? <BlockOutline position={targetBlock} /> : null;
};

export default BlockSelector;
