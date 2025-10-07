import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockOutline } from './BlockOutline';
import { NetworkManager } from '../network';
import { useBlockActions } from '../hooks/useBlockActions';
import { PHYSICS_CONFIG } from '../config/movement';

interface BlockSelectorProps {
  networkManager: NetworkManager | null;
  physicsPositionRef: React.MutableRefObject<THREE.Vector3>;
  isMenuOpen: boolean;
}

export const BlockSelector: React.FC<BlockSelectorProps> = ({ networkManager, physicsPositionRef, isMenuOpen }) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const [targetBlock, setTargetBlock] = useState<[number, number, number] | null>(null);
  const [adjacentPosition, setAdjacentPosition] = useState<[number, number, number] | null>(null);
  const mouseDownRef = useRef<{ button: number; timestamp: number } | null>(null);
  const lastActionTimeRef = useRef(0);
  
  const { breakBlock, placeBlock } = useBlockActions({ networkManager });

  /**
   * Check if placing a block at the given position would collide with the player.
   * Uses the real-time physics position for frame-accurate collision detection.
   * Uses exact AABB matching the physics system for perfect accuracy.
   */
  const wouldCollideWithPlayer = useCallback((blockPos: [number, number, number]): boolean => {
    const [bx, by, bz] = blockPos;
    
    // Get real-time physics position (updated every frame)
    const playerX = physicsPositionRef.current.x;
    const playerY = physicsPositionRef.current.y;
    const playerZ = physicsPositionRef.current.z;
    
    const playerFeetY = playerY - PHYSICS_CONFIG.playerEyeHeight;
    const halfWidth = PHYSICS_CONFIG.playerWidth / 2;
    
    // Use exact physics AABB without margin
    const playerMinX = playerX - halfWidth;
    const playerMaxX = playerX + halfWidth;
    const playerMinY = playerFeetY;
    const playerMaxY = playerFeetY + PHYSICS_CONFIG.playerHeight;
    const playerMinZ = playerZ - halfWidth;
    const playerMaxZ = playerZ + halfWidth;
    
    const blockMinX = bx;
    const blockMaxX = bx + 1;
    const blockMinY = by;
    const blockMaxY = by + 1;
    const blockMinZ = bz;
    const blockMaxZ = bz + 1;
    
    // Standard AABB intersection test
    return (
      playerMinX < blockMaxX &&
      playerMaxX > blockMinX &&
      playerMinY < blockMaxY &&
      playerMaxY > blockMinY &&
      playerMinZ < blockMaxZ &&
      playerMaxZ > blockMinZ
    );
  }, [physicsPositionRef]);

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
    const REPEAT_DELAY = 200; // Milliseconds between repeated actions when holding mouse
    
    const handleMouseDown = (e: MouseEvent) => {
      // Don't allow block actions when menu is open
      if (isMenuOpen || !targetBlock) return;

      // Track which button was pressed
      mouseDownRef.current = { button: e.button, timestamp: Date.now() };
      
      // Immediate action on first click
      if (e.button === 0) {
        // Left click - break block
        breakBlock(targetBlock);
        lastActionTimeRef.current = Date.now();
      } else if (e.button === 2 && adjacentPosition) {
        // Right click - place block
        e.preventDefault();
        
        if (!wouldCollideWithPlayer(adjacentPosition)) {
          placeBlock(adjacentPosition);
          lastActionTimeRef.current = Date.now();
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Clear mouse down state when button released
      if (mouseDownRef.current && mouseDownRef.current.button === e.button) {
        mouseDownRef.current = null;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Continuous action when holding mouse button
    const intervalId = setInterval(() => {
      if (!mouseDownRef.current || isMenuOpen || !targetBlock) return;
      
      const now = Date.now();
      if (now - lastActionTimeRef.current < REPEAT_DELAY) return;

      if (mouseDownRef.current.button === 0) {
        // Holding left click - break block
        breakBlock(targetBlock);
        lastActionTimeRef.current = now;
      } else if (mouseDownRef.current.button === 2 && adjacentPosition) {
        // Holding right click - place block
        if (!wouldCollideWithPlayer(adjacentPosition)) {
          placeBlock(adjacentPosition);
          lastActionTimeRef.current = now;
        }
      }
    }, 50); // Check every 50ms for smooth continuous placement

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(intervalId);
    };
  }, [targetBlock, adjacentPosition, breakBlock, placeBlock, isMenuOpen, wouldCollideWithPlayer]);

  return targetBlock ? <BlockOutline position={targetBlock} /> : null;
};

export default BlockSelector;
