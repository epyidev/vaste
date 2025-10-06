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
  const wasOnGround = useRef(false); // Pour détecter le moment du saut
  const currentGroundBlockId = useRef(0);

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

    // Détecter les transitions sol/air
    const justLanded = onGround.current && !wasOnGround.current;
    const justJumped = !onGround.current && wasOnGround.current;
    wasOnGround.current = onGround.current;

    // Déterminer la vitesse cible selon le mode
    const speedTarget = sprint && forward ? PHYSICS_CONFIG.sprintSpeed : PHYSICS_CONFIG.walkSpeed;

    // Construire la direction d'entrée (normalisée)
    const inputX = (right ? 1 : 0) - (left ? 1 : 0);
    const inputZ = (backward ? 1 : 0) - (forward ? 1 : 0);
    const inputVector = new THREE.Vector2(inputX, inputZ);
    
    if (inputVector.length() > 0) {
      inputVector.normalize();
    }

    // Obtenir la direction de la caméra
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    
    const length = cameraDirection.length();
    if (length > 0.001) {
      cameraDirection.normalize();
    } else {
      const euler = new THREE.Euler().setFromQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
      const yaw = euler.y;
      cameraDirection.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    }

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
    cameraRight.normalize();

    // Calculer la direction voulue dans l'espace monde
    const inputDirection = new THREE.Vector3();
    inputDirection.addScaledVector(cameraRight, inputVector.x);
    inputDirection.addScaledVector(cameraDirection, -inputVector.y);

    // ========================================
    // SYSTÈME DE MOMENTUM - ACCÉLÉRATION HORIZONTALE
    // ========================================
    
    // Accélération selon si on est au sol ou en l'air
    const accel = onGround.current ? PHYSICS_CONFIG.groundAcceleration : PHYSICS_CONFIG.airAcceleration;
    
    if (inputVector.length() > 0) {
      // Appliquer l'accélération dans la direction d'entrée
      velocity.current.x += inputDirection.x * accel * dt;
      velocity.current.z += inputDirection.z * accel * dt;
    }

    // Clamp de la vitesse horizontale selon le mode
    const horizontalSpeed = Math.sqrt(
      velocity.current.x * velocity.current.x + 
      velocity.current.z * velocity.current.z
    );
    
    if (horizontalSpeed > speedTarget) {
      const scale = speedTarget / horizontalSpeed;
      velocity.current.x *= scale;
      velocity.current.z *= scale;
    }

    // ========================================
    // FRICTION DE L'AIR
    // ========================================
    
    if (!onGround.current) {
      // Convertir la friction par seconde en friction par frame
      // friction_per_frame = friction_per_second ^ dt
      const airFrictionPerFrame = Math.pow(PHYSICS_CONFIG.airFrictionPerSecond, dt);
      velocity.current.x *= airFrictionPerFrame;
      velocity.current.z *= airFrictionPerFrame;
    }

    // ========================================
    // FRICTION AU SOL (via BlockRegistry)
    // ========================================
    
    if (onGround.current && inputVector.length() === 0) {
      // Appliquer la friction du bloc quand aucune entrée
      const blockFriction = getBlockFriction(currentGroundBlockId.current);
      velocity.current.x *= blockFriction;
      velocity.current.z *= blockFriction;
      
      // Arrêt complet si vitesse très faible
      if (Math.abs(velocity.current.x) < 0.01) velocity.current.x = 0;
      if (Math.abs(velocity.current.z) < 0.01) velocity.current.z = 0;
    }

    // ========================================
    // GRAVITÉ
    // ========================================
    
    velocity.current.y -= PHYSICS_CONFIG.gravity * dt;

    // ========================================
    // SAUT AVEC CONSERVATION DU MOMENTUM
    // ========================================
    
    if (jump && onGround.current) {
      // Impulsion verticale
      velocity.current.y = PHYSICS_CONFIG.jumpVelocity;
      
      // Conservation du momentum horizontal (MOMENTUM_RETAIN)
      velocity.current.x *= PHYSICS_CONFIG.momentumRetain;
      velocity.current.z *= PHYSICS_CONFIG.momentumRetain;
      
      onGround.current = false;
    }

    // ========================================
    // MISE À JOUR DE LA POSITION
    // ========================================

    const moveDelta = velocity.current.clone().multiplyScalar(dt);
    const playerFeetY = position.current.y - PHYSICS_CONFIG.playerEyeHeight;

    // Si aucun chunk chargé, physique simple
    if (chunks.size === 0) {
      position.current.add(moveDelta);
      
      const groundLevel = spawnPoint.y;
      if (position.current.y - PHYSICS_CONFIG.playerEyeHeight < groundLevel) {
        position.current.y = groundLevel + PHYSICS_CONFIG.playerEyeHeight;
        velocity.current.y = 0;
        onGround.current = true;
      } else {
        onGround.current = false;
      }
    } else {
      // Détection de collision avec le monde voxel
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

      // Mettre à jour l'état au sol
      onGround.current = result.onGround;
      currentGroundBlockId.current = result.groundBlockId;
      
      // Gérer la vélocité après collision
      const expectedDelta = moveDelta.clone();
      
      if (Math.abs(result.velocity.x - expectedDelta.x) > 0.001) {
        velocity.current.x = 0;
      }
      
      if (Math.abs(result.velocity.z - expectedDelta.z) > 0.001) {
        velocity.current.z = 0;
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
