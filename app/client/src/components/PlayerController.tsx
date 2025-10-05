import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NetworkManager } from "../network";

interface PlayerControllerProps {
  controlsRef: React.RefObject<any>;
  spawnPoint: { x: number; y: number; z: number };
  networkManager: NetworkManager | null;
}

const MOVE_SPEED = 4.317; // Minecraft walking speed
const SPRINT_MULTIPLIER = 1.3;
const JUMP_FORCE = 8;
const GRAVITY = 25;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 4; // chunks

export function PlayerController({ controlsRef, spawnPoint, networkManager }: PlayerControllerProps) {
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const position = useRef(new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z));
  const keys = useRef<Record<string, boolean>>({});
  const onGround = useRef(false);
  const lastNetworkUpdate = useRef(0);
  const requestedChunks = useRef(new Set<string>());
  const lastChunkUpdate = useRef(0);

  useEffect(() => {
    position.current.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
    
    // Request initial chunks around spawn point
    if (networkManager) {
      console.log(`[PlayerController] Requesting chunks around spawn point (${spawnPoint.x}, ${spawnPoint.y}, ${spawnPoint.z})`);
      requestChunksAroundPlayer(spawnPoint.x, spawnPoint.y, spawnPoint.z);
    }
  }, [spawnPoint, networkManager]);

  // Request chunks around player position
  const requestChunksAroundPlayer = (x: number, y: number, z: number) => {
    if (!networkManager) return;

    const playerChunkX = Math.floor(x / CHUNK_SIZE);
    const playerChunkY = Math.floor(y / CHUNK_SIZE);
    const playerChunkZ = Math.floor(z / CHUNK_SIZE);

    console.log(`[PlayerController] Player chunk: (${playerChunkX}, ${playerChunkY}, ${playerChunkZ})`);

    let requestCount = 0;

    // Request chunks in a cube around the player
    for (let cx = playerChunkX - RENDER_DISTANCE; cx <= playerChunkX + RENDER_DISTANCE; cx++) {
      for (let cy = playerChunkY - RENDER_DISTANCE; cy <= playerChunkY + RENDER_DISTANCE; cy++) {
        for (let cz = playerChunkZ - RENDER_DISTANCE; cz <= playerChunkZ + RENDER_DISTANCE; cz++) {
          // Only request chunks within render distance
          const dx = cx - playerChunkX;
          const dy = cy - playerChunkY;
          const dz = cz - playerChunkZ;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (distance <= RENDER_DISTANCE) {
            const chunkKey = `${cx},${cy},${cz}`;
            
            // Only request if not already requested
            if (!requestedChunks.current.has(chunkKey)) {
              networkManager.requestChunk(cx, cy, cz);
              requestedChunks.current.add(chunkKey);
              requestCount++;
            }
          }
        }
      }
    }

    if (requestCount > 0) {
      console.log(`[PlayerController] Requested ${requestCount} new chunks`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      
      // Prevent space from scrolling
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

    // Limit delta to prevent large jumps
    const dt = Math.min(delta, 0.1);

    // Get movement input
    const forward = keys.current.KeyW || keys.current.ArrowUp;
    const backward = keys.current.KeyS || keys.current.ArrowDown;
    const left = keys.current.KeyA || keys.current.ArrowLeft;
    const right = keys.current.KeyD || keys.current.ArrowRight;
    const jump = keys.current.Space;
    const sprint = keys.current.ShiftLeft || keys.current.ShiftRight;

    // Calculate movement direction
    const direction = new THREE.Vector3();
    const frontVector = new THREE.Vector3(0, 0, (backward ? 1 : 0) - (forward ? 1 : 0));
    const sideVector = new THREE.Vector3((left ? 1 : 0) - (right ? 1 : 0), 0, 0);

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(MOVE_SPEED * (sprint ? SPRINT_MULTIPLIER : 1));

    // Apply camera rotation to movement direction
    direction.applyEuler(camera.rotation);
    direction.y = 0; // Don't move up/down based on camera angle

    // Apply horizontal movement
    velocity.current.x = direction.x;
    velocity.current.z = direction.z;

    // Apply gravity
    velocity.current.y -= GRAVITY * dt;

    // Jump
    if (jump && onGround.current) {
      velocity.current.y = JUMP_FORCE;
      onGround.current = false;
    }

    // Update position
    position.current.x += velocity.current.x * dt;
    position.current.y += velocity.current.y * dt;
    position.current.z += velocity.current.z * dt;

    // Simple ground collision (temporary - will be replaced with proper voxel collision)
    const groundLevel = spawnPoint.y - PLAYER_HEIGHT + 0.1;
    if (position.current.y < groundLevel) {
      position.current.y = groundLevel;
      velocity.current.y = 0;
      onGround.current = true;
    }

    // Update camera position
    camera.position.copy(position.current);

    // Request chunks as player moves (every 500ms)
    const now = Date.now();
    if (networkManager && now - lastChunkUpdate.current > 500) {
      requestChunksAroundPlayer(position.current.x, position.current.y, position.current.z);
      lastChunkUpdate.current = now;
    }

    // Send position to server (throttled to ~10 times per second)
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
