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

    // Sprint only applies to forward movement
    const forwardSpeed = sprint ? PHYSICS_CONFIG.sprintSpeed : PHYSICS_CONFIG.walkSpeed;
    const backwardSpeed = PHYSICS_CONFIG.walkSpeed * 0.75; // 75% of walk speed (3.24 / 4.317)
    const strafeSpeed = PHYSICS_CONFIG.walkSpeed * 0.765; // 76.5% of walk speed (3.30 / 4.317)

    // Build input vector with directional speeds (NOT normalized yet)
    const inputX = (right ? strafeSpeed : 0) - (left ? strafeSpeed : 0);
    const inputZ = (backward ? backwardSpeed : 0) - (forward ? forwardSpeed : 0);

    const inputVector = new THREE.Vector2(inputX, inputZ);
    
    // Normalize to prevent diagonal movement from being faster
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

    // After normalization, multiply by the dominant speed
    // The normalized vector already accounts for direction mixing
    const dominantSpeed = Math.max(Math.abs(inputX), Math.abs(inputZ));
    
    const targetVelocity = new THREE.Vector3();
    targetVelocity.addScaledVector(cameraRight, inputVector.x * dominantSpeed);
    targetVelocity.addScaledVector(cameraDirection, -inputVector.y * dominantSpeed);

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
    
    // Friction only applies when no input (sliding/gliding)
    const friction = currentFriction.current;
    
    // Apply friction when on ground and no input
    const hasInput = inputVector.length() > 0;

    // Check if player is sliding (has significant velocity without input)
    const currentSpeed = Math.sqrt(velocity.current.x * velocity.current.x + velocity.current.z * velocity.current.z);

    if (onGround.current) {
      if (hasInput) {
        // Player is actively moving
        // No friction interference, no landing delay, no direction resistance
        // Just instant, responsive control (100% control when on ground)
        velocity.current.x = targetVelocity.x;
        velocity.current.z = targetVelocity.z;
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
      // In air - smooth, limited control
      // You can adjust trajectory but not change direction completely
      
      if (hasInput) {
        // Calculate how much the desired direction differs from current velocity
        const currentVel = new THREE.Vector2(velocity.current.x, velocity.current.z);
        const targetVel = new THREE.Vector2(targetVelocity.x, targetVelocity.z);
        
        // Detect if this is mainly a camera rotation or WASD input
        // If current and target speeds are similar, it's probably camera rotation
        const currentSpeed = currentVel.length();
        const targetSpeed = targetVel.length();
        const speedRatio = currentSpeed > 0.1 ? Math.abs(targetSpeed - currentSpeed) / currentSpeed : 1.0;
        
        // Calculate angle difference
        let angleDiff = 0;
        if (currentSpeed > 0.1 && targetSpeed > 0.1) {
          const dot = currentVel.dot(targetVel) / (currentSpeed * targetSpeed);
          angleDiff = Math.acos(Math.max(-1, Math.min(1, dot))); // Clamp to avoid NaN
        }
        
        // Determine control strength based on what changed
        let airControlStrength;
        
        if (speedRatio < 0.3 && angleDiff > 0.5) {
          // Mainly camera rotation (speed unchanged, large angle change)
          // Very minimal control for camera rotation - almost none
          airControlStrength = 0.005; // 0.5% = extremely slow camera-induced rotation
        } else {
          // WASD input change (speed change or small angle change)
          // Reduced by 1/3 as requested: 0.1 → 0.067
          airControlStrength = 0.067; // ~6.7% blend per frame
        }
        
        // Smoothly interpolate toward target velocity
        velocity.current.x += (targetVelocity.x - velocity.current.x) * airControlStrength;
        velocity.current.z += (targetVelocity.z - velocity.current.z) * airControlStrength;
        
        // Apply very minimal air friction (98% = almost no slowdown)
        velocity.current.x *= 0.98;
        velocity.current.z *= 0.98;
      } else {
        // No input in air - preserve momentum with minimal air friction
        // This maintains your velocity when you release keys mid-jump
        velocity.current.x *= 0.98;
        velocity.current.z *= 0.98;
        
        // Don't stop - keep momentum (only stop if truly negligible)
        if (Math.abs(velocity.current.x) < 0.001) velocity.current.x = 0;
        if (Math.abs(velocity.current.z) < 0.001) velocity.current.z = 0;
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
      
      // Update ground state
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
