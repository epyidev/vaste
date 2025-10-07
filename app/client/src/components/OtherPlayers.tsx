import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";

interface PlayerData {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
}

interface OtherPlayersProps {
  players: Map<string, PlayerData>;
  currentPlayerId: string | null;
}

// Player state for smooth rendering
interface PlayerRenderState {
  currentPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

// Generate a consistent color for each player based on their ID
const getPlayerColor = (playerId: string): string => {
  const colors = [
    "#FF6B6B", // red
    "#4ECDC4", // cyan
    "#45B7D1", // blue
    "#FFA07A", // light salmon
    "#98D8C8", // mint
    "#F7DC6F", // yellow
    "#BB8FCE", // purple
    "#85C1E2", // sky blue
    "#F8B500", // orange
    "#7DCEA0", // green
  ];
  
  // Use hash of player ID to consistently select a color
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

function OtherPlayer({ player }: { player: PlayerData }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = useMemo(() => getPlayerColor(player.id), [player.id]);
  
  // Render state with smooth interpolation
  const renderState = useRef<PlayerRenderState>({
    currentPosition: new THREE.Vector3(player.x, player.y - 0.9, player.z),
    targetPosition: new THREE.Vector3(player.x, player.y - 0.9, player.z)
  });
  
  // Player dimensions (similar to actual player hitbox)
  const width = 0.6;
  const height = 1.8;
  const depth = 0.6;
  
  // Configuration
  const INTERPOLATION_SPEED = 0.3; // Smooth interpolation speed (0.2-0.4 recommended)
  const MAX_TELEPORT_DISTANCE = 5; // If distance > 5 units, teleport instead of interpolate
  
  // Update target position when player data changes
  useEffect(() => {
    const state = renderState.current;
    const newTargetPos = new THREE.Vector3(player.x, player.y - 0.9, player.z);
    
    // Calculate distance to detect teleports
    const distance = state.targetPosition.distanceTo(newTargetPos);
    
    // Teleport if distance is too large (player respawned or teleported)
    if (distance > MAX_TELEPORT_DISTANCE) {
      state.currentPosition.copy(newTargetPos);
    }
    
    state.targetPosition.copy(newTargetPos);
  }, [player.x, player.y, player.z]);
  
  // Smooth interpolation
  useFrame(() => {
    if (!meshRef.current) return;
    
    const state = renderState.current;
    
    // Smooth interpolation towards target position
    state.currentPosition.lerp(state.targetPosition, INTERPOLATION_SPEED);
    
    // Update mesh position
    meshRef.current.position.copy(state.currentPosition);
  });
  
  return (
    <group>
      {/* Player box */}
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Username text above player - follows interpolated position */}
      <Text
        position={[
          renderState.current.currentPosition.x,
          renderState.current.currentPosition.y + height / 2 + 0.3,
          renderState.current.currentPosition.z
        ]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {player.username}
      </Text>
    </group>
  );
}

export function OtherPlayers({ players, currentPlayerId }: OtherPlayersProps) {
  // Filter out current player
  const otherPlayers = useMemo(() => {
    const filtered: PlayerData[] = [];
    players.forEach((player, id) => {
      if (id !== currentPlayerId) {
        filtered.push(player);
      }
    });
    return filtered;
  }, [players, currentPlayerId]);
  
  return (
    <>
      {otherPlayers.map((player) => (
        <OtherPlayer key={player.id} player={player} />
      ))}
    </>
  );
}
