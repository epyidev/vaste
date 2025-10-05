/**
 * Game.tsx - Main game component
 * Handles player controls, world rendering, and network communication
 */

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import { NetworkManager, GameState } from "./network";
import { OptimizedWorld } from "./components/OptimizedWorld";
import { ChunkCoords, DEFAULT_RENDER_CONFIG } from "./types";
import { logger } from "./utils/logger";

interface GameProps {
  serverUrl: string;
  user: any;
}

export function Game({ serverUrl, user }: GameProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [worldAssigned, setWorldAssigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Connecting to server...");
  
  const networkRef = useRef<NetworkManager | null>(null);
  const playerPositionRef = useRef({ x: 0, y: 70, z: 0 });
  const playerVelocityRef = useRef({ x: 0, y: 0, z: 0 });
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastUpdateRef = useRef(Date.now());

  // Movement settings
  const MOVE_SPEED = 5;
  const JUMP_FORCE = 8;
  const GRAVITY = 20;
  const GROUND_Y = 64; // Default ground level for flatworld

  // Initialize network manager
  useEffect(() => {
    const network = new NetworkManager(
      (state) => {
        setGameState(state);
      },
      (isConnected) => {
        setConnected(isConnected);
        if (!isConnected) {
          setLoadingMessage("Disconnected from server");
          setLoading(true);
        }
      },
      user
    );

    // Set world assignment callback
    network.setOnWorldAssigned((spawnPoint) => {
      logger.info(`[Game] World assigned, spawning at (${spawnPoint.x}, ${spawnPoint.y}, ${spawnPoint.z})`);
      
      playerPositionRef.current = { ...spawnPoint };
      setWorldAssigned(true);
      setLoading(false);
    });

    networkRef.current = network;

    // Connect to server
    network.connect(serverUrl).then(() => {
      logger.info("[Game] Connected to server");
      setLoadingMessage("Waiting for world assignment...");
    }).catch((error) => {
      logger.error("[Game] Connection error:", error);
      setLoadingMessage("Failed to connect to server");
    });

    return () => {
      network.disconnect();
    };
  }, [serverUrl, user]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

      // Jump
      if (e.code === "Space" && playerPositionRef.current.y <= GROUND_Y + 0.1) {
        playerVelocityRef.current.y = JUMP_FORCE;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Game loop - update player physics and send position
  useEffect(() => {
    if (!worldAssigned || !networkRef.current) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      const keys = keysRef.current;
      const position = playerPositionRef.current;
      const velocity = playerVelocityRef.current;

      // Calculate movement direction
      let moveX = 0;
      let moveZ = 0;

      if (keys["KeyW"]) moveZ -= 1;
      if (keys["KeyS"]) moveZ += 1;
      if (keys["KeyA"]) moveX -= 1;
      if (keys["KeyD"]) moveX += 1;

      // Normalize diagonal movement
      if (moveX !== 0 && moveZ !== 0) {
        const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= length;
        moveZ /= length;
      }

      // Apply movement
      position.x += moveX * MOVE_SPEED * deltaTime;
      position.z += moveZ * MOVE_SPEED * deltaTime;

      // Apply gravity
      velocity.y -= GRAVITY * deltaTime;
      position.y += velocity.y * deltaTime;

      // Ground collision
      if (position.y < GROUND_Y) {
        position.y = GROUND_Y;
        velocity.y = 0;
      }

      // Send position to server (every 50ms)
      if (networkRef.current) {
        networkRef.current.sendPlayerMove(position.x, position.y, position.z);
      }
    }, 50);

    return () => {
      clearInterval(interval);
    };
  }, [worldAssigned]);

  // Loading screen
  if (loading || !gameState || !worldAssigned) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a2e",
        color: "#eee",
        fontFamily: "monospace",
      }}>
        <div style={{ fontSize: "24px", marginBottom: "20px" }}>
          {loadingMessage}
        </div>
        <div style={{ fontSize: "14px", color: "#888" }}>
          {connected ? "Connected" : "Disconnected"}
        </div>
        {connected && !worldAssigned && (
          <div style={{ marginTop: "20px", fontSize: "12px", color: "#666", maxWidth: "400px", textAlign: "center" }}>
            Waiting for the server mod to create a world...
            <br />
            The server must call CreateOrLoadWorld() before you can join.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{
          position: [playerPositionRef.current.x, playerPositionRef.current.y + 1.6, playerPositionRef.current.z],
          fov: 75,
          near: 0.1,
          far: 1000,
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        {/* Sky */}
        <Sky sunPosition={[100, 100, 100]} />

        {/* World */}
        <OptimizedWorld
          chunks={gameState.chunks}
          playerPosition={playerPositionRef.current}
          renderDistance={{
            horizontal: DEFAULT_RENDER_CONFIG.horizontalDistance,
            vertical: DEFAULT_RENDER_CONFIG.verticalDistance,
          }}
        />

        {/* Controls */}
        <PointerLockControls
          onUpdate={(controls) => {
            // Update camera position to follow player
            const camera = controls.getObject();
            camera.position.x = playerPositionRef.current.x;
            camera.position.y = playerPositionRef.current.y + 1.6; // Eye height
            camera.position.z = playerPositionRef.current.z;
          }}
        />
      </Canvas>

      {/* HUD */}
      <div style={{
        position: "fixed",
        top: "10px",
        left: "10px",
        color: "white",
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: "10px",
        borderRadius: "5px",
        pointerEvents: "none",
      }}>
        <div>Position: ({Math.floor(playerPositionRef.current.x)}, {Math.floor(playerPositionRef.current.y)}, {Math.floor(playerPositionRef.current.z)})</div>
        <div>Chunks: {gameState.chunks.size}</div>
        <div>Players: {gameState.players.size}</div>
        {gameState.generatorType && <div>Generator: {gameState.generatorType}</div>}
      </div>

      {/* Controls info */}
      <div style={{
        position: "fixed",
        bottom: "10px",
        left: "10px",
        color: "white",
        fontFamily: "monospace",
        fontSize: "11px",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: "10px",
        borderRadius: "5px",
        pointerEvents: "none",
      }}>
        <div>WASD: Move</div>
        <div>Space: Jump</div>
        <div>Mouse: Look around</div>
        <div>Click to lock cursor</div>
      </div>
    </div>
  );
}
