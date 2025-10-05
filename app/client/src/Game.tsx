import { useEffect, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import { NetworkManager } from "./network";
import { VoxelWorld } from "./components/VoxelWorld";
import { PlayerController } from "./components/PlayerController";

interface GameProps {
  serverUrl: string;
  user: any;
}

export function Game({ serverUrl, user }: GameProps) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [spawnPoint, setSpawnPoint] = useState({ x: 0, y: 50, z: 0 });
  const [chunks, setChunks] = useState<Map<string, any>>(new Map());
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
  const [fps, setFps] = useState(0);
  const networkRef = useRef<NetworkManager | null>(null);
  const controlsRef = useRef<any>(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });

  // FPS Counter
  useEffect(() => {
    let frameId: number;
    
    const updateFps = () => {
      const counter = fpsCounterRef.current;
      counter.frames++;
      
      const currentTime = performance.now();
      const elapsed = currentTime - counter.lastTime;
      
      if (elapsed >= 1000) { // Update every second
        setFps(Math.round((counter.frames * 1000) / elapsed));
        counter.frames = 0;
        counter.lastTime = currentTime;
      }
      
      frameId = requestAnimationFrame(updateFps);
    };
    
    frameId = requestAnimationFrame(updateFps);
    
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const network = new NetworkManager(
      (state) => {
        // Update chunks whenever state changes
        setChunks(new Map(state.chunks));
      },
      (isConnected) => setConnected(isConnected)
    );
    
    network.setAuthenticatedUser(user);
    network.setOnWorldAssigned((spawn) => {
      setSpawnPoint(spawn);
      setLoading(false);
    });
    
    networkRef.current = network;
    network.connect(serverUrl);
    
    return () => network.disconnect();
  }, [serverUrl, user]);

  if (loading) {
    return (
      <div style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(to bottom, #1a1a2e 0%, #0f0f1e 100%)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif"
      }}>
        <div style={{ fontSize: "32px", marginBottom: "20px" }}>Vaste</div>
        <div style={{ fontSize: "18px", opacity: 0.7 }}>
          {connected ? "Loading world..." : "Connecting to server..."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{
          position: [spawnPoint.x, spawnPoint.y + 1.8, spawnPoint.z],
          fov: 75,
          near: 0.1,
          far: 1000
        }}
        shadows
      >
        {/* Controls */}
        <PointerLockControls ref={controlsRef} />
        
        {/* Player Controller */}
        <PlayerController 
          controlsRef={controlsRef}
          spawnPoint={spawnPoint}
          networkManager={networkRef.current}
          onPositionChange={setPlayerPos}
        />
        
        {/* Sky */}
        <Sky
          distance={450000}
          sunPosition={[100, 20, 100]}
          inclination={0.6}
          azimuth={0.25}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        
        {/* Fog */}
        <fog attach="fog" args={["#87CEEB", 80, 200]} />
        
        {/* Voxel World */}
        <VoxelWorld chunks={chunks} />
      </Canvas>

      {/* HUD */}
      <div style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: "14px",
        textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
        userSelect: "none",
        pointerEvents: "none"
      }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>FPS: {fps}</div>
        <div style={{ marginTop: "5px" }}>Chunks: {chunks.size}</div>
        <div style={{ marginTop: "5px" }}>
          Position: X: {playerPos.x.toFixed(1)} Y: {playerPos.y.toFixed(1)} Z: {playerPos.z.toFixed(1)}
        </div>
        <div style={{ marginTop: "10px", opacity: 0.7, fontSize: "12px" }}>
          Press ESC to unlock cursor
        </div>
      </div>

      {/* Crosshair */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none"
      }}>
        <svg width="40" height="40">
          <line x1="20" y1="15" x2="20" y2="25" stroke="white" strokeWidth="2" />
          <line x1="15" y1="20" x2="25" y2="20" stroke="white" strokeWidth="2" />
          <circle cx="20" cy="20" r="3" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
