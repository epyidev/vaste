import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NetworkManager } from "../network";
import { VoxelPhysics } from "../physics/VoxelPhysics";
import { PHYSICS_CONFIG } from "../config/movement";
import { getBlockFriction } from "../data/BlockRegistry";

interface PlayerControllerProps {
  controlsRef: React.RefObject<any>;
  spawnPoint: { x: number; y: number; z: number };
  networkManager: NetworkManager | null;
  onPositionChange?: (pos: { x: number; y: number; z: number }) => void;
  renderDistance?: number;
  clearRequestedChunks?: boolean;
  chunks: Map<string, any>;
}

const CHUNK_SIZE = 16;

export function PlayerController({
  controlsRef,
  spawnPoint,
  networkManager,
  onPositionChange,
  renderDistance = 4,
  clearRequestedChunks,
  chunks
}: PlayerControllerProps) {
  const position = useRef(new THREE.Vector3(
    spawnPoint.x,
    spawnPoint.y + PHYSICS_CONFIG.playerEyeHeight,
    spawnPoint.z
  ));
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const keys = useRef<Record<string, boolean>>({});
  const onGround = useRef(false);
  const currentGroundBlockId = useRef(0);
  const currentFriction = useRef(0.6); // Smoothed friction value

  const lastNetworkUpdate = useRef(0);
  const lastChunkUpdate = useRef(0);
  const lastPositionUpdate = useRef(0);
  const requestedChunks = useRef(new Set<string>());

  useEffect(() => {
    position.current.set(
      spawnPoint.x,
      spawnPoint.y + PHYSICS_CONFIG.playerEyeHeight,
      spawnPoint.z
    );
    velocity.current.set(0, 0, 0);

    if (networkManager) {
      requestChunksAroundPlayer(spawnPoint.x, spawnPoint.y, spawnPoint.z);
    }
  }, [spawnPoint, networkManager]);

  useEffect(() => {
    if (clearRequestedChunks) {
      requestedChunks.current.clear();
      if (networkManager) {
        networkManager.cancelPendingChunkRequests();
      }
    }
  }, [clearRequestedChunks, networkManager]);

  const requestChunksAroundPlayer = (x: number, y: number, z: number) => {
    if (!networkManager) return;

    const playerChunkX = Math.floor(x / CHUNK_SIZE);
    const playerChunkY = Math.floor(y / CHUNK_SIZE);
    const playerChunkZ = Math.floor(z / CHUNK_SIZE);

    const chunksToRequest: Array<{ cx: number; cy: number; cz: number; distance: number }> = [];

    for (let cx = playerChunkX - renderDistance; cx <= playerChunkX + renderDistance; cx++) {
      for (let cy = playerChunkY - renderDistance; cy <= playerChunkY + renderDistance; cy++) {
        for (let cz = playerChunkZ - renderDistance; cz <= playerChunkZ + renderDistance; cz++) {
          const dx = cx - playerChunkX;
          const dy = cy - playerChunkY;
          const dz = cz - playerChunkZ;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (distance <= renderDistance) {
            const chunkKey = `${cx},${cy},${cz}`;
            if (!requestedChunks.current.has(chunkKey)) {
              chunksToRequest.push({ cx, cy, cz, distance });
            }
          }
        }
      }
    }

    chunksToRequest.sort((a, b) => a.distance - b.distance);

    for (const chunk of chunksToRequest) {
      networkManager.requestChunk(chunk.cx, chunk.cy, chunk.cz);
      requestedChunks.current.add(`${chunk.cx},${chunk.cy},${chunk.cz}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "Space") {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    const camera = controlsRef.current.getObject();
    if (!camera) return;

    const dt = Math.min(delta, 0.1);

    const forward = keys.current.KeyW || keys.current.ArrowUp;
    const backward = keys.current.KeyS || keys.current.ArrowDown;
    const left = keys.current.KeyA || keys.current.ArrowLeft;
    const right = keys.current.KeyD || keys.current.ArrowRight;
    const jump = keys.current.Space;
    const sprint = keys.current.ShiftLeft || keys.current.ShiftRight;

    let targetSpeed = PHYSICS_CONFIG.walkSpeed;
    if (sprint) {
      targetSpeed = PHYSICS_CONFIG.sprintSpeed;
    }

    const inputX = (right ? 1 : 0) - (left ? 1 : 0);
    const inputZ = (backward ? 1 : 0) - (forward ? 1 : 0);

    const inputVector = new THREE.Vector2(inputX, inputZ);
    if (inputVector.length() > 0) {
      inputVector.normalize();
    }

    // Get camera's forward direction
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Project onto horizontal plane
    cameraDirection.y = 0;
    
    // Normalize (will be zero if looking straight up/down)
    const length = cameraDirection.length();
    if (length > 0.001) {
      cameraDirection.normalize();
    } else {
      // When looking straight up/down, use camera's rotation around Y axis
      // Get the camera's world rotation
      const euler = new THREE.Euler().setFromQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
      const yaw = euler.y;
      cameraDirection.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    }

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
    cameraRight.normalize();

    const targetVelocity = new THREE.Vector3();
    targetVelocity.addScaledVector(cameraRight, inputVector.x * targetSpeed);
    targetVelocity.addScaledVector(cameraDirection, -inputVector.y * targetSpeed);

    const controlFactor = onGround.current ? 1.0 : PHYSICS_CONFIG.airControl;

    // Get friction from the block beneath the player
    const targetFriction = getBlockFriction(currentGroundBlockId.current);
    
    // Smooth friction transitions to avoid abrupt changes when moving between blocks
    // This prevents sudden stops when sliding from one block to another
    const frictionBlendSpeed = 5.0; // How fast friction adapts (lower = smoother)
    if (onGround.current) {
      // Gradually blend toward target friction
      currentFriction.current += (targetFriction - currentFriction.current) * Math.min(1.0, frictionBlendSpeed * dt);
    } else {
      // In air, keep the friction from the last ground block
      // This maintains sliding momentum when falling off edges
    }
    
    const friction = currentFriction.current;
    
    // Apply friction when on ground and no input
    const hasInput = inputVector.length() > 0;

    // Check if player is sliding (has significant velocity without input)
    const currentSpeed = Math.sqrt(velocity.current.x * velocity.current.x + velocity.current.z * velocity.current.z);
    const isSliding = currentSpeed > 0.5;

    // Directly set velocity for instant response (like Minecraft)
    if (onGround.current) {
      if (hasInput) {
        // Player is trying to move
        if (isSliding) {
          // Player is sliding and trying to change direction
          // Calculate angle between current velocity and desired direction
          const currentVel = new THREE.Vector2(velocity.current.x, velocity.current.z);
          const targetVel = new THREE.Vector2(targetVelocity.x, targetVelocity.z);
          
          if (currentVel.length() > 0.1 && targetVel.length() > 0.1) {
            currentVel.normalize();
            targetVel.normalize();
            
            // Dot product gives us how aligned the directions are (-1 = opposite, 1 = same)
            const alignment = currentVel.dot(targetVel);
            
            // If trying to go opposite direction (alignment < 0), apply friction-based resistance
            if (alignment < 0.5) {
              // Fighting against the slide - friction slows down the transition
              // Higher friction = harder to change direction
              const resistanceFactor = 1.0 - (friction * 0.7); // friction 0.6 = 58% control, friction 0.98 = 31% control
              const transitionSpeed = resistanceFactor * dt * 8.0; // How fast we can change direction
              
              // Blend current velocity toward target velocity based on resistance
              velocity.current.x += (targetVelocity.x - velocity.current.x) * transitionSpeed;
              velocity.current.z += (targetVelocity.z - velocity.current.z) * transitionSpeed;
              
              // Also apply friction to gradually slow down
              velocity.current.x *= friction;
              velocity.current.z *= friction;
            } else {
              // Going with or slightly against the slide - normal control
              velocity.current.x = targetVelocity.x * controlFactor;
              velocity.current.z = targetVelocity.z * controlFactor;
            }
          } else {
            velocity.current.x = targetVelocity.x * controlFactor;
            velocity.current.z = targetVelocity.z * controlFactor;
          }
        } else {
          // Not sliding - normal instant control
          velocity.current.x = targetVelocity.x * controlFactor;
          velocity.current.z = targetVelocity.z * controlFactor;
        }
      } else {
        // Apply friction when no input - reduces velocity based on friction coefficient
        // Lower friction (0.0-0.5) = stops quickly
        // Higher friction (0.5-1.0) = slides more
        velocity.current.x *= friction;
        velocity.current.z *= friction;
        
        // Stop completely if velocity is very small
        if (Math.abs(velocity.current.x) < 0.01) velocity.current.x = 0;
        if (Math.abs(velocity.current.z) < 0.01) velocity.current.z = 0;
      }
    } else {
      // In air, preserve momentum from sliding with slight air friction
      if (hasInput) {
        // Player is actively controlling in air
        const airAccel = PHYSICS_CONFIG.airAcceleration * dt;
        const dx = (targetVelocity.x - velocity.current.x) * controlFactor;
        const dz = (targetVelocity.z - velocity.current.z) * controlFactor;
        
        velocity.current.x += Math.max(-airAccel, Math.min(airAccel, dx));
        velocity.current.z += Math.max(-airAccel, Math.min(airAccel, dz));
      } else {
        // Player is gliding in air (from sliding off a block) - apply slight air friction
        // Use a higher friction in air to simulate air resistance (but still preserve sliding)
        const airFriction = Math.min(friction + 0.05, 0.98); // Slightly more friction in air
        velocity.current.x *= airFriction;
        velocity.current.z *= airFriction;
        
        // Stop completely if velocity is very small
        if (Math.abs(velocity.current.x) < 0.01) velocity.current.x = 0;
        if (Math.abs(velocity.current.z) < 0.01) velocity.current.z = 0;
      }
    }

    velocity.current.y -= PHYSICS_CONFIG.gravity * dt;

    if (jump && onGround.current) {
      velocity.current.y = PHYSICS_CONFIG.jumpVelocity;
    }

    const moveDelta = velocity.current.clone().multiplyScalar(dt);

    const playerFeetY = position.current.y - PHYSICS_CONFIG.playerEyeHeight;

    // If no chunks loaded, use simple physics without collision
    if (chunks.size === 0) {
      position.current.add(moveDelta);
      
      // Simple ground check at spawn level
      const groundLevel = spawnPoint.y;
      if (position.current.y - PHYSICS_CONFIG.playerEyeHeight < groundLevel) {
        position.current.y = groundLevel + PHYSICS_CONFIG.playerEyeHeight;
        velocity.current.y = 0;
        onGround.current = true;
      } else {
        onGround.current = false;
      }
    } else {
      // Use proper collision detection
      const result = VoxelPhysics.sweepAABB(
        chunks,
        new THREE.Vector3(position.current.x, playerFeetY, position.current.z),
        moveDelta,
        PHYSICS_CONFIG.playerWidth,
        PHYSICS_CONFIG.playerHeight
      );

      position.current.set(
        result.position.x,
        result.position.y + PHYSICS_CONFIG.playerEyeHeight,
        result.position.z
      );

      // Don't stop horizontal velocity when gliding - only stop if we hit a wall while grounded with input
      const expectedDelta = moveDelta.clone();
      const wasOnGround = onGround.current;
      
      // Update ground state first
      onGround.current = result.onGround;
      currentGroundBlockId.current = result.groundBlockId;
      
      // Handle velocity after collision
      // Only zero horizontal velocity if:
      // 1. Player is actively trying to move into a wall (has input)
      // 2. OR player hit a wall while NOT sliding (low horizontal velocity)
      const isSliding = !hasInput && (Math.abs(velocity.current.x) > 0.1 || Math.abs(velocity.current.z) > 0.1);
      
      if (Math.abs(result.velocity.x - expectedDelta.x) > 0.001) {
        // X collision detected
        if (hasInput || !isSliding) {
          velocity.current.x = 0;
        }
        // If sliding, keep velocity to allow sliding off edges
      }
      
      if (Math.abs(result.velocity.z - expectedDelta.z) > 0.001) {
        // Z collision detected
        if (hasInput || !isSliding) {
          velocity.current.z = 0;
        }
        // If sliding, keep velocity to allow sliding off edges
      }
      
      if (Math.abs(result.velocity.y - expectedDelta.y) > 0.001) {
        velocity.current.y = 0;
      }
    }

    camera.position.copy(position.current);

    const now = Date.now();

    if (onPositionChange && now - lastPositionUpdate.current > 200) {
      onPositionChange({
        x: position.current.x,
        y: position.current.y,
        z: position.current.z
      });
      lastPositionUpdate.current = now;
    }

    if (networkManager && now - lastChunkUpdate.current > 500) {
      requestChunksAroundPlayer(position.current.x, position.current.y, position.current.z);
      lastChunkUpdate.current = now;
    }

    if (networkManager && now - lastNetworkUpdate.current > 100) {
      networkManager.sendMessage({
        type: "player_move",
        x: position.current.x,
        y: position.current.y,
        z: position.current.z
      });
      lastNetworkUpdate.current = now;
    }
  });

  return null;
}
