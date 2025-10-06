import { useEffect, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import { NetworkManager } from "./network";
import { VoxelWorld } from "./components/VoxelWorld";
import { PlayerController } from "./components/PlayerController";
import { BlockSelector } from "./components/BlockSelector";
import LoadingScreen from "./components/ui/LoadingScreen";
import { PauseMenu } from "./components/ui/PauseMenu";
import { SettingsMenu } from "./components/ui/SettingsMenu";
import { useNavigate } from "react-router-dom";

interface GameProps {
  serverUrl: string;
  user: any;
}

export function Game({ serverUrl, user }: GameProps) {
  const navigate = useNavigate();
  const [loadingState, setLoadingState] = useState<'connecting' | 'loading-world' | 'loading-chunks' | 'ready'>('connecting');
  const [connected, setConnected] = useState(false);
  const [spawnPoint, setSpawnPoint] = useState({ x: 0, y: 50, z: 0 });
  const [chunks, setChunks] = useState<Map<string, any>>(new Map());
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
  const playerPosVector = useRef(new THREE.Vector3(0, 0, 0));
  const [fps, setFps] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [renderDistance, setRenderDistance] = useState(() => {
    const saved = localStorage.getItem('vaste_renderDistance');
    return saved ? parseInt(saved) : 4;
  });
  const [maxRenderDistance, setMaxRenderDistance] = useState(12); // Default 12, server will override
  const [forceRenderDistance, setForceRenderDistance] = useState<boolean>(false);
  const [ambientOcclusionEnabled, setAmbientOcclusionEnabled] = useState(() => {
    const saved = localStorage.getItem('vaste_ambientOcclusion');
    return saved !== null ? saved === 'true' : false; // Default disabled for performance
  });
  const [clearChunks, setClearChunks] = useState(false);
  const networkRef = useRef<NetworkManager | null>(null);
  const controlsRef = useRef<any>(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const initialChunksLoadedRef = useRef(false);

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

  // Handle window focus/blur to prevent camera jumps
  useEffect(() => {
    const handleBlur = () => {
      // When window loses focus, unlock pointer to prevent accumulated movements
      if (controlsRef.current && isPointerLocked) {
        controlsRef.current.unlock();
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isPointerLocked]);

  useEffect(() => {
    const network = new NetworkManager(
      (state) => {
        // Update chunks whenever state changes
        setChunks(new Map(state.chunks));
      },
      (isConnected) => {
        setConnected(isConnected);
        if (isConnected) {
          setLoadingState('loading-world');
          setLoadingProgress(30);
        }
      }
    );
    
    network.setAuthenticatedUser(user);
    network.setOnWorldAssigned((spawn, serverSettings) => {
      setSpawnPoint(spawn);
      
      console.log('[Game] Received server settings:', serverSettings);
      
      // Apply server render distance settings
      if (serverSettings?.maxRenderDistance !== undefined) {
        console.log('[Game] Setting maxRenderDistance to:', serverSettings.maxRenderDistance);
        setMaxRenderDistance(serverSettings.maxRenderDistance);
      } else {
        console.log('[Game] No maxRenderDistance from server, using default 12');
      }
      if (serverSettings?.forceRenderDistance === true) {
        setForceRenderDistance(true);
        setRenderDistance(serverSettings.maxRenderDistance || 12);
        localStorage.setItem('vaste_renderDistance', (serverSettings.maxRenderDistance || 12).toString());
      } else {
        // Clamp client render distance to server max
        const currentRenderDistance = parseInt(localStorage.getItem('vaste_renderDistance') || '4');
        const clampedRenderDistance = Math.min(currentRenderDistance, serverSettings?.maxRenderDistance || 12);
        setRenderDistance(clampedRenderDistance);
        localStorage.setItem('vaste_renderDistance', clampedRenderDistance.toString());
      }
      
      setLoadingState('loading-chunks');
      setLoadingProgress(60);
    });
    
    networkRef.current = network;
    network.connect(serverUrl);
    
    return () => network.disconnect();
  }, [serverUrl, user]);

  // Check if initial chunks around spawn are loaded (just enough to not fall)
  useEffect(() => {
    if (loadingState !== 'loading-chunks' || initialChunksLoadedRef.current) return;

    const CHUNK_SIZE = 16;
    const HORIZONTAL_RADIUS = 1; // Just 1 chunk around spawn horizontally
    
    const spawnChunkX = Math.floor(spawnPoint.x / CHUNK_SIZE);
    const spawnChunkY = Math.floor(spawnPoint.y / CHUNK_SIZE);
    const spawnChunkZ = Math.floor(spawnPoint.z / CHUNK_SIZE);
    
    let requiredChunks = 0;
    let loadedChunks = 0;
    
    // Count required chunks (only horizontal plane, not above/below)
    for (let cx = spawnChunkX - HORIZONTAL_RADIUS; cx <= spawnChunkX + HORIZONTAL_RADIUS; cx++) {
      for (let cz = spawnChunkZ - HORIZONTAL_RADIUS; cz <= spawnChunkZ + HORIZONTAL_RADIUS; cz++) {
        requiredChunks++;
        const key = `${cx},${spawnChunkY},${cz}`;
        if (chunks.has(key)) {
          loadedChunks++;
        }
      }
    }
    
    // Update progress
    const chunkProgress = (loadedChunks / requiredChunks) * 40; // 40% of total progress
    setLoadingProgress(60 + chunkProgress);
    
    // If spawn chunk is loaded, we're good to go (player won't fall)
    if (loadedChunks >= 1) { // Just need at least the spawn chunk
      initialChunksLoadedRef.current = true;
      setLoadingProgress(100);
      // Start fade out after a brief moment
      setTimeout(() => {
        setLoadingState('ready');
        // Fade out loading screen smoothly
        setTimeout(() => {
          setShowLoadingScreen(false);
        }, 600); // Wait for fade animation
      }, 200);
    }
  }, [chunks, loadingState, spawnPoint]);

  // Track pointer lock state and smooth mouse movements
  useEffect(() => {
    let ignoreNextMovement = false;
    let movementTimeout: number;
    const movementHistory: { x: number; y: number; time: number }[] = [];
    const MAX_HISTORY = 3; // Keep last 3 movements for smoothing
    const MAX_MOVEMENT = 30; // Maximum pixels per movement to prevent spikes
    let lastMovementTime = 0;

    const handleLockChange = () => {
      const locked = document.pointerLockElement !== null;
      setIsPointerLocked(locked);
      
      // If pause menu or settings menu is open and user tries to lock pointer, prevent it
      if (locked && (isPaused || isSettingsOpen)) {
        if (controlsRef.current) {
          controlsRef.current.unlock();
        }
      }

      // When locking, clear history and ignore first movement
      if (locked) {
        ignoreNextMovement = true;
        movementHistory.length = 0;
        lastMovementTime = performance.now();
        clearTimeout(movementTimeout);
        movementTimeout = setTimeout(() => {
          ignoreNextMovement = false;
        }, 50);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;

      const now = performance.now();
      const timeDelta = now - lastMovementTime;

      // Ignore first movement after lock
      if (ignoreNextMovement) {
        e.stopImmediatePropagation();
        ignoreNextMovement = false;
        lastMovementTime = now;
        return;
      }

      // Ignore movements after long pauses (tab switch, etc.)
      if (timeDelta > 200) {
        lastMovementTime = now;
        movementHistory.length = 0;
        return;
      }

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      // Clamp extreme movements
      const clampedX = Math.max(-MAX_MOVEMENT, Math.min(MAX_MOVEMENT, movementX));
      const clampedY = Math.max(-MAX_MOVEMENT, Math.min(MAX_MOVEMENT, movementY));

      // Detect spikes (movement much larger than recent average)
      if (movementHistory.length > 0) {
        const avgX = movementHistory.reduce((sum, m) => sum + Math.abs(m.x), 0) / movementHistory.length;
        const avgY = movementHistory.reduce((sum, m) => sum + Math.abs(m.y), 0) / movementHistory.length;
        
        // If movement is 3x larger than average, it's likely a spike
        if (Math.abs(clampedX) > avgX * 3 || Math.abs(clampedY) > avgY * 3) {
          lastMovementTime = now;
          return; // Ignore this spike
        }
      }

      // Add to history
      movementHistory.push({ x: clampedX, y: clampedY, time: now });
      if (movementHistory.length > MAX_HISTORY) {
        movementHistory.shift();
      }

      lastMovementTime = now;
    };

    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('mousemove', handleMouseMove, { capture: true });
    
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      clearTimeout(movementTimeout);
    };
  }, [isPaused, isSettingsOpen]);

  // Block browser shortcuts when pointer is locked (playing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block common browser shortcuts when playing
      if (isPointerLocked) {
        // Ctrl/Cmd combinations
        if (e.ctrlKey || e.metaKey) {
          const blockedKeys = ['s', 'w', 'n', 't', 'r', 'f', 'h', 'p', 'o', 'g', 'u', 'j', 'd', 'l'];
          if (blockedKeys.includes(e.key.toLowerCase())) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }
        
        // F-keys (F1, F3, F5, F11, F12, etc.)
        if (e.key.startsWith('F') && e.key.length <= 3) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    // Capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isPointerLocked]);

  // Handle ESC key for pause menu and settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && loadingState === 'ready') {
        e.preventDefault();
        
        // Close settings if open
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          setIsPaused(true);
          return;
        }
        
        // Toggle pause menu if pointer is unlocked
        if (!isPointerLocked) {
          setIsPaused(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadingState, isPointerLocked, isSettingsOpen]);

  // Pause menu handlers
  const handleResume = () => {
    setIsPaused(false);
    // Re-lock the pointer after a small delay
    setTimeout(() => {
      if (controlsRef.current) {
        controlsRef.current.lock();
      }
    }, 100);
  };

  const handleOpenSettings = () => {
    setIsPaused(false);
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setIsPaused(true);
  };

  const handleRenderDistanceChange = (newDistance: number) => {
    if (forceRenderDistance === true) {
      // Can't change if forced by server
      return;
    }
    const clampedDistance = Math.min(newDistance, maxRenderDistance);
    setRenderDistance(clampedDistance);
    localStorage.setItem('vaste_renderDistance', clampedDistance.toString());
    
    // Clear chunks to force reload with new render distance
    if (networkRef.current) {
      networkRef.current.clearChunks();
    }
    setChunks(new Map());
    setClearChunks(true);
    setTimeout(() => setClearChunks(false), 100);
  };

  const handleAmbientOcclusionChange = (enabled: boolean) => {
    setAmbientOcclusionEnabled(enabled);
    localStorage.setItem('vaste_ambientOcclusion', enabled.toString());
  };

  const handlePlayerPositionChange = (pos: { x: number; y: number; z: number }) => {
    setPlayerPos(pos);
    playerPosVector.current.set(pos.x, pos.y, pos.z);
  };

  const handleDisconnect = () => {
    if (networkRef.current) {
      networkRef.current.disconnect();
    }
    navigate('/servers');
  };

  // Get loading message based on state
  const getLoadingMessage = () => {
    switch (loadingState) {
      case 'connecting':
        return 'Connecting to server...';
      case 'loading-world':
        return 'Loading world data...';
      case 'loading-chunks':
        return 'Loading terrain...';
      default:
        return 'Loading...';
    }
  };

  return (
    <div style={{ position: "fixed", width: "100vw", height: "100vh" }}>
      {/* Loading Screen with fade out */}
      {showLoadingScreen && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1000,
          opacity: loadingState === 'ready' ? 0 : 1,
          transition: 'opacity 0.6s ease-out',
          pointerEvents: loadingState === 'ready' ? 'none' : 'auto'
        }}>
          <LoadingScreen
            message={getLoadingMessage()}
            progress={loadingProgress}
            showProgress={true}
          />
        </div>
      )}

      {/* Game Canvas - Wrapper to block interactions when paused */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: isPaused ? 'none' : 'auto',
      }}>
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
          onPositionChange={handlePlayerPositionChange}
          renderDistance={renderDistance}
          clearRequestedChunks={clearChunks}
          chunks={chunks}
        />
        
        {/* Block Selection Outline */}
        <BlockSelector 
          networkManager={networkRef.current} 
          playerPosition={playerPos}
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
        <VoxelWorld chunks={chunks} ambientOcclusionEnabled={ambientOcclusionEnabled} />
      </Canvas>
      </div>

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
          {isPointerLocked ? 'Press ESC to unlock cursor' : 'Press ESC again for pause menu'}
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

      {/* Pause Menu */}
      <PauseMenu
        isOpen={isPaused && !isSettingsOpen}
        onResume={handleResume}
        onDisconnect={handleDisconnect}
        onOpenSettings={handleOpenSettings}
      />

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        currentRenderDistance={renderDistance}
        maxRenderDistance={maxRenderDistance}
        onRenderDistanceChange={handleRenderDistanceChange}
        forceRenderDistance={forceRenderDistance}
        ambientOcclusionEnabled={ambientOcclusionEnabled}
        onAmbientOcclusionChange={handleAmbientOcclusionChange}
      />
    </div>
  );
}
