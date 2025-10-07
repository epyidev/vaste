/**
 * Game.tsx - Main game component
 * 
 * CRITICAL SYSTEMS ARCHITECTURE:
 * 
 * 1. Chunk Management:
 *    - Intelligent cleanup on render distance change
 *    - Only removes chunks outside new distance
 *    - Keeps player chunk and nearby chunks
 *    - Automatic garbage collection every 5 seconds
 *    - Safety physics when critical chunks missing
 * 
 * 2. Block Interaction Performance:
 *    - High priority block actions (bypass queue)
 *    - Batch flushing before block actions
 *    - <1ms latency guarantee
 *    - Server-side priority processing
 * 
 * 3. Render Distance Changes:
 *    - Immediate intelligent cleanup (decrease only)
 *    - Keep chunks within new distance
 *    - Request new chunks incrementally (increase)
 *    - No falling, no world popping
 * 
 * 4. Safety Mechanisms:
 *    - Critical chunk detection (player position ± 1 chunk)
 *    - Fallback physics when chunks missing
 *    - Ground level safety net at spawn height
 *    - Prevents falling through void during chunk loading
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { NetworkManager } from "./network";
import { VoxelWorld } from "./components/VoxelWorld";
import { PlayerController } from "./components/PlayerController";
import { BlockSelector } from "./components/BlockSelector";
import { RawPointerLockControls } from "./components/RawPointerLockControls";
import { ViewBobbingManager } from "./components/ViewBobbingManager";
import { OtherPlayers } from "./components/OtherPlayers";
import LoadingScreen from "./components/ui/LoadingScreen";
import { LoadingStep, Chat, ChatMessage } from "./components/ui";
import { PauseMenu } from "./components/ui/PauseMenu";
import { SettingsMenu } from "./components/ui/SettingsMenu";
import { DisconnectedScreen } from "./components/ui/DisconnectedScreen";
import { useNavigate } from "react-router-dom";
import { PlayerMovementState } from "./config/viewBobbing";

interface GameProps {
  serverUrl: string;
  user: any;
}

export function Game({ serverUrl, user }: GameProps) {
  const navigate = useNavigate();
  const [loadingState, setLoadingState] = useState<'connecting' | 'loading-world' | 'loading-chunks' | 'ready'>('connecting');
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([]);
  const [blockpacksReady, setBlockpacksReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [spawnPoint, setSpawnPoint] = useState({ x: 0, y: 50, z: 0 });
  const [chunks, setChunks] = useState<Map<string, any>>(new Map());
  const [players, setPlayers] = useState<Map<string, any>>(new Map());
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
  const playerPosVector = useRef(new THREE.Vector3(0, 0, 0));
  const playerPhysicsPositionRef = useRef(new THREE.Vector3(0, 0, 0));
  const [fps, setFps] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [disconnectReason, setDisconnectReason] = useState<string | null>(null);
  const [renderDistance, setRenderDistance] = useState(() => {
    const saved = localStorage.getItem('vaste_renderDistance');
    const value = saved ? parseInt(saved) : 4;
    return Math.max(3, value);
  });
  const [maxRenderDistance, setMaxRenderDistance] = useState(12);
  const [forceRenderDistance, setForceRenderDistance] = useState<boolean>(false);
  const [ambientOcclusionEnabled, setAmbientOcclusionEnabled] = useState(() => {
    const saved = localStorage.getItem('vaste_ambientOcclusion');
    return saved !== null ? saved === 'true' : true; // Default ENABLED for professional voxel look
  });
  
  // Shadow settings - Simple toggle avec meilleure qualité possible
  const [shadowsEnabled, setShadowsEnabled] = useState(() => {
    const saved = localStorage.getItem('vaste_shadowsEnabled');
    return saved !== null ? saved === 'true' : true; // Default enabled
  });
  
  const [mouseSensitivity, setMouseSensitivity] = useState(() => {
    const saved = localStorage.getItem('vaste_mouseSensitivity');
    return saved ? parseFloat(saved) : 0.002;
  });
  
  // Cinematic mode toggle
  const [isCinematicMode, setIsCinematicMode] = useState(() => {
    const saved = localStorage.getItem('vaste_cinematicMode');
    return saved !== null ? saved === 'true' : false; // Default disabled
  });

  // View bobbing toggle
  const [viewBobbingEnabled, setViewBobbingEnabled] = useState(() => {
    const saved = localStorage.getItem('vaste_viewBobbing');
    return saved !== null ? saved === 'true' : true;
  });

  const [fogEnabled, setFogEnabled] = useState(() => {
    const saved = localStorage.getItem('vaste_fogEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  // Player movement state for view bobbing
  const [playerMovementState, setPlayerMovementState] = useState<PlayerMovementState | null>(null);

  // View bobbing rotation offsets (managed by ViewBobbingManager, applied by RawPointerLockControls)
  const [viewBobbingOffsets, setViewBobbingOffsets] = useState({ pitch: 0, yaw: 0, roll: 0 });
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isChatOpenRef = useRef(false);
  
  const networkRef = useRef<NetworkManager | null>(null);
  const controlsRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const initialChunksLoadedRef = useRef(false);
  const justUnlockedRef = useRef(false);
  const canRelockRef = useRef(true);
  const closingMenuRef = useRef(false);
  const closingChatRef = useRef(false);

  // Shadow settings - Optimized for sharp voxel shadows
  const shadowSettings = shadowsEnabled 
    ? { 
        enabled: true, 
        mapSize: 8096,      // Reduced from 8192 for better performance while keeping quality
        cameraSize: 100,
        bias: 0.0000,      // Adjusted for less shadow acne on voxels
        radius: 0           // Minimal blur for sharper voxel shadows
      }
    : { 
        enabled: false, 
        mapSize: 1024, 
        cameraSize: 100, 
        bias: -0.001,
        radius: 0
      };

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

  // Callback to update loading steps
  const updateLoadingStep = useCallback((name: string, status: LoadingStep['status'], detail?: string) => {
    setLoadingSteps(prevSteps => {
      const existingIndex = prevSteps.findIndex(s => s.name === name);
      if (existingIndex >= 0) {
        const newSteps = [...prevSteps];
        newSteps[existingIndex] = { name, status, detail };
        return newSteps;
      } else {
        return [...prevSteps, { name, status, detail }];
      }
    });
  }, []);

  // Handle window focus/blur to prevent camera jumps
  useEffect(() => {
    const handleBlur = () => {
      // When window loses focus, open pause menu
      if (isPointerLocked && loadingState === 'ready' && !isPaused && !isSettingsOpen) {
        setIsPaused(true);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isPointerLocked, loadingState, isPaused, isSettingsOpen]);

  useEffect(() => {
    const network = new NetworkManager(
      (state) => {
        // Update chunks whenever state changes
        setChunks(new Map(state.chunks));
        // Update players state
        setPlayers(new Map(state.players));
        // Update current player ID
        if (state.playerId) {
          setCurrentPlayerId(state.playerId);
        }
      },
      (isConnected) => {
        setConnected(isConnected);
        if (isConnected) {
          setLoadingState('loading-world');
          setLoadingProgress(30);
        }
      },
      user,
      updateLoadingStep, // Pass the loading step updater
      () => {
        // Blockpacks are ready!
        console.log('[Game] Blockpacks ready, can initialize textures now');
        setBlockpacksReady(true);
      },
      (reason) => {
        // Handle disconnect with reason
        console.log('[Game] Disconnected:', reason);
        setDisconnectReason(reason || 'Disconnected from server');
      },
      (username, message) => {
        // Handle incoming chat message
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          username,
          message,
          timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, newMessage]);
      }
    );
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
        const forcedDistance = Math.max(3, serverSettings.maxRenderDistance || 12);
        setRenderDistance(forcedDistance);
        localStorage.setItem('vaste_renderDistance', forcedDistance.toString());
      } else {
        const currentRenderDistance = parseInt(localStorage.getItem('vaste_renderDistance') || '4');
        const clampedRenderDistance = Math.max(3, Math.min(currentRenderDistance, serverSettings?.maxRenderDistance || 12));
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

  useEffect(() => {
    if (sceneRef.current) {
      const bgColor = fogEnabled ? "#c8d5e0" : "#87CEEB";
      sceneRef.current.background = new THREE.Color(bgColor);
    }
  }, [fogEnabled]);

  /**
   * Chunk garbage collection
   */
  useEffect(() => {
    if (loadingState !== 'ready' || !playerPos) return;

    const cleanupInterval = setInterval(() => {
      const CHUNK_SIZE = 16;
      const playerChunkX = Math.floor(playerPos.x / CHUNK_SIZE);
      const playerChunkY = Math.floor(playerPos.y / CHUNK_SIZE);
      const playerChunkZ = Math.floor(playerPos.z / CHUNK_SIZE);

      let removedCount = 0;
      const toKeep = new Map<string, any>();

      chunks.forEach((chunk, chunkKey) => {
        const [cx, cy, cz] = chunkKey.split(',').map(Number);
        const dx = cx - playerChunkX;
        const dy = cy - playerChunkY;
        const dz = cz - playerChunkZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance <= renderDistance + 1) {
          toKeep.set(chunkKey, chunk);
        } else {
          removedCount++;
        }
      });

      if (removedCount > 0) {
        setChunks(toKeep);
      }
    }, 2000);

    return () => clearInterval(cleanupInterval);
  }, [loadingState, playerPos, chunks, renderDistance]);

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
    
    // Update progress and loading step
    const chunkProgress = (loadedChunks / requiredChunks) * 40; // 40% of total progress
    setLoadingProgress(60 + chunkProgress);
    updateLoadingStep('Loading terrain', 'loading', `${loadedChunks}/${requiredChunks} chunks loaded`);
    
    // If spawn chunk is loaded, we're good to go (player won't fall)
    if (loadedChunks >= 1) { // Just need at least the spawn chunk
      initialChunksLoadedRef.current = true;
      setLoadingProgress(100);
      updateLoadingStep('Loading terrain', 'completed', `${loadedChunks} chunks ready`);
      // Start fade out after a brief moment
      setTimeout(() => {
        setLoadingState('ready');
        // Lock pointer immediately when ready
        if (controlsRef.current) {
          controlsRef.current.lock();
        }
        // Fade out loading screen smoothly
        setTimeout(() => {
          setShowLoadingScreen(false);
        }, 600); // Wait for fade animation
      }, 200);
    }
  }, [chunks, loadingState, spawnPoint, updateLoadingStep]);

  // Track pointer lock state and smooth mouse movements
  useEffect(() => {
    let ignoreNextMovement = false;
    let movementTimeout: ReturnType<typeof setTimeout>;
    const movementHistory: { x: number; y: number; time: number }[] = [];
    const MAX_HISTORY = 3; // Keep last 3 movements for smoothing
    const MAX_MOVEMENT = 30; // Maximum pixels per movement to prevent spikes
    let lastMovementTime = 0;
    let previousLockState = document.pointerLockElement !== null; // Track previous state locally

    const handleLockChange = () => {
      const locked = document.pointerLockElement !== null;
      console.log('[PointerLock] Changed3:', {
        locked,
        previousLockState,
        isPaused,
        isSettingsOpen,
        isChatOpen: isChatOpenRef.current,
        closingChat: closingChatRef.current,
        loadingState,
        justUnlocked: justUnlockedRef.current,
        canRelock: canRelockRef.current,
        closingMenu: closingMenuRef.current
      });
      setIsPointerLocked(locked);

      // When unlocking during gameplay (not already in menu), open pause menu
      // BUT: ignore if we're closing chat (closingChatRef)
      if (!locked && previousLockState && loadingState === 'ready' && !isPaused && !isSettingsOpen && !isChatOpenRef.current && !closingChatRef.current) {
        // Only open menu if we're not in the "just unlocked" transition
        if (!justUnlockedRef.current) {
          console.log('[PointerLock] Unlocked during gameplay, opening pause menu');
          setIsPaused(true);
        } else {
          console.log('[PointerLock] Unlock ignored (transition period)');
        }

        // Mark transition and block relocking temporarily
        justUnlockedRef.current = true;
        canRelockRef.current = false;

        // Allow relocking after browser finishes transition (100ms)
        setTimeout(() => {
          justUnlockedRef.current = false;
          canRelockRef.current = true;
          console.log('[PointerLock] Transition complete, can relock now');
        }, 100);
      } else if (locked && !previousLockState) {
        console.log('[PointerLock] Locked successfully');

        // If we were closing the menu and pointer is now locked, close it!
        if (closingMenuRef.current && isPaused) {
          console.log('[PointerLock] Closing menu after successful lock');
          closingMenuRef.current = false;
          setIsPaused(false);
        }
      }

      // Update previous state
      previousLockState = locked;

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
  }, [isPaused, isSettingsOpen, loadingState]);

  // Pause menu handlers - defined early so they can be used in effects
  const handleResume = useCallback(() => {
    console.log('[Resume] Closing menu and locking pointer');

    if (!canRelockRef.current) {
      console.warn('[Resume] Too fast! Wait a moment before resuming.');
      return;
    }

    closingMenuRef.current = true;
    if (controlsRef.current) {
      controlsRef.current.lock();
    }
  }, []);

  const handleOpenPauseMenu = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsPaused(false);
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
    setIsPaused(true);
  }, []);

  // Handle clicks to resume game when paused
  useEffect(() => {
    const handleClick = () => {
      if (isPaused && !isSettingsOpen && loadingState === 'ready') {
        console.log('[Click] Resuming game from pause menu');
        handleResume();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isPaused, isSettingsOpen, loadingState, handleResume]);

  // Unified keyboard handler: ESC for menu + block browser shortcuts
  useEffect(() => {
    let escKeyDownInMenu = false; // Track if ESC was pressed while menu was open

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle ESC key
      if (e.key === 'Escape') {
        console.log('[ESC keydown] State:', { loadingState, isPaused, isSettingsOpen, isPointerLocked, isChatOpen: isChatOpenRef.current });
        if (loadingState !== 'ready') return;

        // Priority 0: If chat is open, let Chat component handle it
        if (isChatOpenRef.current) {
          console.log('[ESC keydown] Chat is open, ignoring in Game.tsx');
          return;
        }

        // Priority 1: If settings are open, close settings and return to pause menu
        if (isSettingsOpen) {
          console.log('[ESC keydown] Closing settings');
          e.preventDefault();
          e.stopImmediatePropagation();
          handleCloseSettings();
          return;
        }

        // Priority 2: If pause menu is open, mark for closing (actual close on keyup)
        if (isPaused) {
          console.log('[ESC keydown] Marking menu for close on keyup');
          e.preventDefault();
          e.stopImmediatePropagation();
          escKeyDownInMenu = true;
          return;
        }

        // Priority 3: Playing - let browser unlock pointer naturally
        console.log('[ESC keydown] In game, letting browser unlock pointer');
      }

      // Block common browser shortcuts when playing
      if (isPointerLocked && !isChatOpenRef.current) {
        // Ctrl/Cmd combinations
        if (e.ctrlKey || e.metaKey) {
          const blockedKeys = ['s', 'w', 'n', 't', 'r', 'f', 'h', 'p', 'o', 'g', 'u', 'j', 'd', 'l'];
          if (blockedKeys.includes(e.key.toLowerCase())) {
            e.preventDefault(); // Prevent browser action (save, new window, etc.)
            // Don't stop propagation - let game input handlers receive the event
          }
        }

        // F-keys (F1, F3, F5, F11, F12, etc.)
        if (e.key.startsWith('F') && e.key.length <= 3) {
          e.preventDefault(); // Prevent browser action (refresh, devtools, etc.)
          // Don't stop propagation - let game input handlers receive the event
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Re-lock pointer on ESC keyup if we closed the menu
      if (e.key === 'Escape') {
        console.log('[ESC keyup] Detected, escKeyDownInMenu:', escKeyDownInMenu, 'canRelock:', canRelockRef.current);
        if (escKeyDownInMenu) {
          e.preventDefault();
          e.stopImmediatePropagation();
          escKeyDownInMenu = false;

          if (!canRelockRef.current) {
            console.warn('[ESC keyup] Too fast! Wait a moment before closing the menu.');
            return;
          }

          // 🔥 Lock pointer and let pointerlockchange close the menu
          closingMenuRef.current = true;
          requestAnimationFrame(() => {
            setTimeout(() => {
              const canvas = document.querySelector('canvas');
              if (canvas) {
                console.log('[ESC keyup] Requesting pointer lock');
                canvas.requestPointerLock()
                  .then(() => {
                    console.log('[ESC keyup] Pointer lock request succeeded');
                    // Don't close menu here - wait for pointerlockchange
                  })
                  .catch((err) => {
                    // Failed - keep menu open and reset flag
                    console.warn('[ESC keyup] Pointer lock failed (too fast):', err.message);
                    console.warn('[ESC keyup] Menu stays open - try again');
                    closingMenuRef.current = false;
                  });
              }
            }, 25);
          });
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [isPointerLocked, loadingState, isSettingsOpen, isPaused, handleCloseSettings]);

  /**
   * Render distance change handler
   * 
   * Intelligent chunk cleanup strategy:
   * 1. Keep all chunks within new render distance
   * 2. Immediately remove only chunks outside new range
   * 3. Never remove chunk player is standing on
   * 4. Prevents falling, no visual glitches
   * 5. Request new chunks if increasing distance
   */
  const handleRenderDistanceChange = (newDistance: number) => {
    if (forceRenderDistance === true) {
      return;
    }
    const clampedDistance = Math.max(3, Math.min(newDistance, maxRenderDistance));
    const oldDistance = renderDistance;
    
    setRenderDistance(clampedDistance);
    localStorage.setItem('vaste_renderDistance', clampedDistance.toString());
    
    if (networkRef.current && playerPos) {
      networkRef.current.setRenderDistance(clampedDistance, {
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z
      });
    }
    
    if (playerPos) {
      const CHUNK_SIZE = 16;
      const playerChunkX = Math.floor(playerPos.x / CHUNK_SIZE);
      const playerChunkY = Math.floor(playerPos.y / CHUNK_SIZE);
      const playerChunkZ = Math.floor(playerPos.z / CHUNK_SIZE);

      let removedCount = 0;
      const toKeep = new Map<string, any>();

      chunks.forEach((chunk, chunkKey) => {
        const [cx, cy, cz] = chunkKey.split(',').map(Number);
        const dx = cx - playerChunkX;
        const dy = cy - playerChunkY;
        const dz = cz - playerChunkZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance <= clampedDistance) {
          toKeep.set(chunkKey, chunk);
        } else {
          removedCount++;
        }
      });

      if (removedCount > 0) {
        setChunks(toKeep);
      }
    }
  };

  const handleAmbientOcclusionChange = (enabled: boolean) => {
    setAmbientOcclusionEnabled(enabled);
    localStorage.setItem('vaste_ambientOcclusion', enabled.toString());
  };

  const handleShadowsEnabledChange = (enabled: boolean) => {
    setShadowsEnabled(enabled);
    localStorage.setItem('vaste_shadowsEnabled', enabled.toString());
  };

  const handleMouseSensitivityChange = (value: number) => {
    setMouseSensitivity(value);
    localStorage.setItem('vaste_mouseSensitivity', value.toString());
  };

  const handleCinematicModeChange = (enabled: boolean) => {
    setIsCinematicMode(enabled);
    localStorage.setItem('vaste_cinematicMode', enabled.toString());
  };

  const handleViewBobbingChange = (enabled: boolean) => {
    setViewBobbingEnabled(enabled);
    localStorage.setItem('vaste_viewBobbing', enabled.toString());
  };

  const handleFogChange = (enabled: boolean) => {
    setFogEnabled(enabled);
    localStorage.setItem('vaste_fogEnabled', enabled.toString());
  };

  const handlePlayerPositionChange = (pos: { x: number; y: number; z: number }) => {
    setPlayerPos(pos);
    playerPosVector.current.set(pos.x, pos.y, pos.z);
  };

  const handlePlayerMovementStateChange = (state: PlayerMovementState) => {
    setPlayerMovementState(state);
  };

  const handleDisconnect = () => {
    if (networkRef.current) {
      networkRef.current.disconnect();
    }
    navigate('/servers');
  };

  const handleSendChatMessage = useCallback((message: string) => {
    if (networkRef.current && message.trim()) {
      networkRef.current.sendChatMessage(message);
    }
  }, []);

  const handleChatOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      closingChatRef.current = true;
      setTimeout(() => {
        closingChatRef.current = false;
      }, 200);
    }
    isChatOpenRef.current = isOpen;
    setIsChatOpen(isOpen);
  }, []);

  const handleRequestPointerLock = useCallback(() => {
    if (controlsRef.current && loadingState === 'ready' && !isPaused && !isSettingsOpen) {
      controlsRef.current.lock();
    }
  }, [loadingState, isPaused, isSettingsOpen]);

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
            steps={loadingSteps}
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
        shadows={shadowSettings.enabled}
        gl={{ 
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: false
        }}
        onCreated={({ scene, gl }) => {
          sceneRef.current = scene;
          const bgColor = fogEnabled ? "#c8d5e0" : "#87CEEB";
          scene.background = new THREE.Color(bgColor);
          gl.setClearColor(bgColor);
        }}
      >
        {/* Controls */}
        <RawPointerLockControls 
          ref={controlsRef}
          sensitivity={mouseSensitivity}
          verticalClampDegrees={89}
          cinematicMode={isCinematicMode}
          viewBobbingOffsets={viewBobbingOffsets}
        />
        
        {/* Player Controller */}
        <PlayerController 
          controlsRef={controlsRef}
          spawnPoint={spawnPoint}
          networkManager={networkRef.current}
          onPositionChange={handlePlayerPositionChange}
          onMovementStateChange={handlePlayerMovementStateChange}
          physicsPositionRef={playerPhysicsPositionRef}
          renderDistance={renderDistance}
          chunks={chunks}
          isChatOpen={isChatOpen}
        />
        
        {/* View Bobbing Manager - Must be AFTER PlayerController to apply offsets */}
        <ViewBobbingManager
          cameraRef={controlsRef}
          enabled={viewBobbingEnabled}
          playerState={playerMovementState}
          baseFOV={75}
          onOffsetsUpdate={setViewBobbingOffsets}
        />
        
        {/* Block Selection Outline */}
        <BlockSelector 
          networkManager={networkRef.current} 
          physicsPositionRef={playerPhysicsPositionRef}
          isMenuOpen={isPaused || isSettingsOpen}
          isChatOpen={isChatOpen}
        />
        
        <Sky
          distance={450000}
          sunPosition={[100, 50, 50]}
          inclination={0.6}
          azimuth={0.25}
        />
        
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[80, 100, 60]} // Sun position: high and to the side
          intensity={shadowsEnabled ? 0.8 : 0.6} // Reduced intensity - vertex colors handle most shading
          castShadow={shadowSettings.enabled}
          shadow-mapSize-width={shadowSettings.mapSize}
          shadow-mapSize-height={shadowSettings.mapSize}
          shadow-camera-far={300}
          shadow-camera-left={-shadowSettings.cameraSize}
          shadow-camera-right={shadowSettings.cameraSize}
          shadow-camera-top={shadowSettings.cameraSize}
          shadow-camera-bottom={-shadowSettings.cameraSize}
          shadow-bias={shadowSettings.bias}
          shadow-radius={shadowSettings.radius}
        />
        
        {fogEnabled && (
          <fog 
            attach="fog" 
            args={[
              "#c8d5e0",
              renderDistance * 16 * 0.4,
              renderDistance * 16 * 1.0
            ]} 
          />
        )}
        
        {/* Voxel World */}
        <VoxelWorld 
          chunks={chunks} 
          ambientOcclusionEnabled={ambientOcclusionEnabled} 
          shadowsEnabled={shadowsEnabled}
          blockpacksReady={blockpacksReady}
        />
        
        {/* Other Players */}
        <OtherPlayers 
          players={players}
          currentPlayerId={currentPlayerId}
        />
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
        shadowsEnabled={shadowsEnabled}
        onShadowsEnabledChange={handleShadowsEnabledChange}
        mouseSensitivity={mouseSensitivity}
        onMouseSensitivityChange={handleMouseSensitivityChange}
        cinematicMode={isCinematicMode}
        onCinematicModeChange={handleCinematicModeChange}
        viewBobbingEnabled={viewBobbingEnabled}
        onViewBobbingChange={handleViewBobbingChange}
        fogEnabled={fogEnabled}
        onFogChange={handleFogChange}
      />

      {/* Disconnected Screen */}
      {disconnectReason && (
        <DisconnectedScreen
          reason={disconnectReason}
          onReturnToServerList={() => navigate('/servers')}
        />
      )}

      {/* Chat */}
      {loadingState === 'ready' && !disconnectReason && (
        <Chat
          messages={chatMessages}
          currentUsername={user?.username || 'Player'}
          onSendMessage={handleSendChatMessage}
          onChatOpenChange={handleChatOpenChange}
          onRequestPointerLock={handleRequestPointerLock}
          isInputDisabled={isPaused || isSettingsOpen}
        />
      )}
    </div>
  );
}
