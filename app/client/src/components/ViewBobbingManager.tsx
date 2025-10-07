import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW_BOBBING_CONFIG, PlayerMovementState } from '../config/viewBobbing';

interface ViewBobbingManagerProps {
  cameraRef: React.RefObject<any>; // Ref to RawPointerLockControls (which has getObject method)
  enabled: boolean;
  playerState: PlayerMovementState | null;
  baseFOV?: number; // Base FOV from camera settings
  onOffsetsUpdate?: (offsets: { pitch: number; yaw: number; roll: number }) => void;
}

export function ViewBobbingManager({ 
  cameraRef, 
  enabled, 
  playerState,
  baseFOV = 75,
  onOffsetsUpdate
}: ViewBobbingManagerProps) {
  // Animation state
  const bobbingTime = useRef(0);
  const breathingTime = useRef(0);
  const landingTime = useRef(-1);
  const landingImpactStrength = useRef(0); // Store impact strength based on fall velocity
  const lastVerticalVelocity = useRef(0);
  const lastSneakState = useRef(false);

  // Current smooth values (interpolated)
  const currentVerticalOffset = useRef(0);
  const currentHorizontalOffset = useRef(0);
  const currentRoll = useRef(0);
  const currentFOV = useRef(baseFOV);
  const currentPitch = useRef(0);
  const currentSneakLower = useRef(0);
  
  // Directional lean (separate from bobbing)
  const currentLeanPitch = useRef(0);
  const currentLeanRoll = useRef(0);

  // Target values (calculated each frame)
  const targetVerticalOffset = useRef(0);
  const targetHorizontalOffset = useRef(0);
  const targetRoll = useRef(0);
  const targetFOV = useRef(baseFOV);
  const targetPitch = useRef(0);
  const targetSneakLower = useRef(0);
  
  // Directional lean targets
  const targetLeanPitch = useRef(0);
  const targetLeanRoll = useRef(0);

  // Store the base position set by PlayerController
  const basePosition = useRef(new THREE.Vector3());

  // Update baseFOV when it changes
  useEffect(() => {
    currentFOV.current = baseFOV;
    targetFOV.current = baseFOV;
  }, [baseFOV]);

  // Detect landing
  useEffect(() => {
    if (!playerState) return;

    // Detect landing: was falling with significant velocity, now on ground
    const justLanded = 
      playerState.isOnGround && 
      lastVerticalVelocity.current < -VIEW_BOBBING_CONFIG.landing.minVelocity &&
      playerState.verticalVelocity >= -1.0;

    if (justLanded && enabled) {
      landingTime.current = 0;
      
      // Calculate impact strength based on fall velocity (proportional)
      const fallSpeed = Math.abs(lastVerticalVelocity.current);
      // Normalize: minVelocity = 0%, maxFallSpeed = 100%
      const maxFallSpeed = 30.0; // Maximum expected fall velocity
      const normalizedFallSpeed = Math.min(
        (fallSpeed - VIEW_BOBBING_CONFIG.landing.minVelocity) / 
        (maxFallSpeed - VIEW_BOBBING_CONFIG.landing.minVelocity),
        1.0
      );
      
      // Store impact strength (0 to 1)
      landingImpactStrength.current = normalizedFallSpeed;
    }

    lastVerticalVelocity.current = playerState.verticalVelocity;
  }, [playerState, enabled]);

  useFrame((state, delta) => {
    if (!cameraRef.current || !enabled || !playerState) {
      // Reset to defaults when disabled
      if (cameraRef.current) {
        const camera = cameraRef.current.getObject();
        if (camera && camera.fov !== undefined) {
          const perspectiveCamera = camera as THREE.PerspectiveCamera;
          perspectiveCamera.fov = baseFOV;
          perspectiveCamera.updateProjectionMatrix();
        }
      }
      return;
    }

    // Get camera from controls
    const camera = cameraRef.current.getObject();
    if (!camera) return;

    const config = VIEW_BOBBING_CONFIG;

    // ========================================
    // CALCULATE TARGET VALUES BASED ON STATE
    // ========================================

    let verticalTarget = 0;
    let horizontalTarget = 0;
    let rollTarget = 0;
    let fovTarget = baseFOV;
    let pitchTarget = 0;

    // Update timers
    if (playerState.isMoving && playerState.isOnGround) {
      // Increment bobbing time based on speed (so slower movement = slower bobbing)
      const speedRatio = playerState.horizontalSpeed / 6.0; // Normalize against sprint speed
      bobbingTime.current += delta * speedRatio;
    } else {
      // Gradually reset bobbing time when not moving
      bobbingTime.current *= 0.95;
    }

    breathingTime.current += delta;

    // Landing animation - proportional impact with instant down, progressive up
    if (landingTime.current >= 0) {
      landingTime.current += delta;
      const impactPhase = config.landing.impactDuration;
      const recoveryPhase = config.landing.impactRecovery;
      const totalDuration = impactPhase + recoveryPhase;
      
      if (landingTime.current < totalDuration) {
        let impactValue = 0;
        
        if (landingTime.current < impactPhase) {
          // Phase 1: Instant impact (très rapide, quasi-instantané)
          const impactProgress = landingTime.current / impactPhase;
          // Courbe exponentielle très rapide pour descente quasi-instantanée
          const impactCurve = 1 - Math.pow(1 - impactProgress, 4);
          impactValue = impactCurve;
        } else {
          // Phase 2: Progressive recovery (redressement progressif)
          const recoveryProgress = (landingTime.current - impactPhase) / recoveryPhase;
          // Courbe ease-out pour redressement naturel
          const recoveryCurve = 1 - Math.pow(recoveryProgress, 2);
          impactValue = recoveryCurve;
        }
        
        // Apply proportional impact based on fall velocity
        // Max impact capped at 0.5 blocks (half block)
        const maxImpact = 0.5;
        const scaledImpact = maxImpact * landingImpactStrength.current * impactValue;
        verticalTarget -= scaledImpact;
      } else {
        landingTime.current = -1;
        landingImpactStrength.current = 0;
      }
    }

    // State-based bobbing
    if (playerState.state === 'walking' && playerState.isOnGround) {
      const cfg = config.walk;
      const time = bobbingTime.current;

      // Vertical bob (sine wave)
      verticalTarget += Math.sin(time * cfg.verticalFrequency * Math.PI * 2) * cfg.verticalAmount;

      // Horizontal bob (sine wave at half frequency)
      horizontalTarget += Math.sin(time * cfg.horizontalFrequency * Math.PI * 2) * cfg.horizontalAmount;

      // Roll (synced with horizontal)
      rollTarget += Math.sin(time * cfg.rollFrequency * Math.PI * 2) * cfg.rollAmount;
    } 
    else if (playerState.state === 'sprinting' && playerState.isOnGround) {
      const cfg = config.sprint;
      const time = bobbingTime.current;

      // More intense bobbing
      verticalTarget += Math.sin(time * cfg.verticalFrequency * Math.PI * 2) * cfg.verticalAmount;
      horizontalTarget += Math.sin(time * cfg.horizontalFrequency * Math.PI * 2) * cfg.horizontalAmount;
      rollTarget += Math.sin(time * cfg.rollFrequency * Math.PI * 2) * cfg.rollAmount;
    } 
    else if (playerState.state === 'sneaking' && playerState.isOnGround) {
      const cfg = config.sneak;
      const time = bobbingTime.current;

      // Subtle bobbing
      verticalTarget += Math.sin(time * cfg.verticalFrequency * Math.PI * 2) * cfg.verticalAmount;
      horizontalTarget += Math.sin(time * cfg.horizontalFrequency * Math.PI * 2) * cfg.horizontalAmount;
      rollTarget += Math.sin(time * cfg.rollFrequency * Math.PI * 2) * cfg.rollAmount;
    }
    else if (playerState.state === 'falling') {
      const cfg = config.falling;

      // Upward drift when falling (floating feeling)
      const fallSpeed = Math.abs(playerState.verticalVelocity);
      
      // Only apply effect when falling fast enough (progressive threshold)
      if (fallSpeed > cfg.minFallSpeed) {
        // Progressive factor: 0 at minFallSpeed, 1 at liftMaxSpeed
        const speedRange = cfg.liftMaxSpeed - cfg.minFallSpeed;
        const speedAboveMin = fallSpeed - cfg.minFallSpeed;
        const liftFactor = Math.min(speedAboveMin / speedRange, 1.0);
        
        // Apply smooth curve for more natural progression
        const smoothFactor = liftFactor * liftFactor; // Quadratic easing
        verticalTarget += cfg.verticalLift * smoothFactor;
      }

      // Slight upward pitch with maximum cap (also progressive)
      if (fallSpeed > cfg.minFallSpeed) {
        const speedRange = cfg.liftMaxSpeed - cfg.minFallSpeed;
        const speedAboveMin = fallSpeed - cfg.minFallSpeed;
        const pitchFactor = Math.min(speedAboveMin / speedRange, 1.0);
        
        const pitchValue = cfg.pitchAmount * THREE.MathUtils.DEG2RAD * pitchFactor;
        const maxPitchRad = cfg.maxPitchAngle * THREE.MathUtils.DEG2RAD;
        pitchTarget += Math.min(pitchValue, maxPitchRad);
      }
    } 
    else if (playerState.state === 'idle' && config.idle.enabled) {
      const cfg = config.idle;

      // Subtle breathing
      verticalTarget += Math.sin(breathingTime.current * cfg.breathingFrequency * Math.PI * 2) * cfg.breathingAmount;
    }
    
    // ========================================
    // FOV MANAGEMENT - Based on sprinting state, not movement state
    // ========================================
    
    if (playerState.isSprinting) {
      // Apply sprint FOV whenever sprinting, regardless of being on ground/in air
      fovTarget = baseFOV + config.sprint.fovAmount;
    } else if (playerState.state === 'falling') {
      // Apply subtle falling FOV only when not sprinting
      const fallSpeed = Math.abs(playerState.verticalVelocity);
      if (fallSpeed > config.falling.liftMaxSpeed * 0.5) {
        fovTarget = baseFOV + config.falling.fovAmount;
      }
    }

    // ========================================
    // SNEAK CAMERA LOWERING
    // ========================================
    
    if (playerState.isSneaking) {
      targetSneakLower.current = config.sneak.cameraLowerAmount;
    } else {
      targetSneakLower.current = 0;
    }

    // ========================================
    // DIRECTIONAL CAMERA LEAN
    // ========================================
    
    let leanPitchTarget = 0;
    let leanRollTarget = 0;
    
    if (config.directionalLean.enabled && playerState.isOnGround && playerState.isMoving) {
      const leanCfg = config.directionalLean;
      
      // Forward/backward pitch lean
      if (playerState.inputZ < 0) {
        // Moving forward - slight downward tilt
        leanPitchTarget = -leanCfg.forwardPitchAmount * Math.abs(playerState.inputZ) * THREE.MathUtils.DEG2RAD;
      } else if (playerState.inputZ > 0) {
        // Moving backward - slight upward tilt
        leanPitchTarget = leanCfg.backwardPitchAmount * playerState.inputZ * THREE.MathUtils.DEG2RAD;
      }
      
      // Clamp pitch to max angle
      const maxPitch = leanCfg.maxPitchAngle * THREE.MathUtils.DEG2RAD;
      leanPitchTarget = THREE.MathUtils.clamp(leanPitchTarget, -maxPitch, maxPitch);
      
      // Left/right roll lean
      if (playerState.inputX !== 0) {
        // Lean into the strafe direction
        leanRollTarget = -leanCfg.strafeRollAmount * playerState.inputX * THREE.MathUtils.DEG2RAD;
      }
      
      // Clamp roll to max angle
      const maxRoll = leanCfg.maxRollAngle * THREE.MathUtils.DEG2RAD;
      leanRollTarget = THREE.MathUtils.clamp(leanRollTarget, -maxRoll, maxRoll);
    }
    
    targetLeanPitch.current = leanPitchTarget;
    targetLeanRoll.current = leanRollTarget;

    // ========================================
    // SMOOTH INTERPOLATION
    // ========================================

    const smoothing = config.smoothingFactor;
    
    targetVerticalOffset.current = verticalTarget;
    targetHorizontalOffset.current = horizontalTarget;
    targetRoll.current = rollTarget;
    targetFOV.current = fovTarget;
    targetPitch.current = pitchTarget;

    // Use slower smoothing for vertical offset when transitioning from falling
    const verticalSmoothing = (playerState.state !== 'falling' && currentVerticalOffset.current > 0.01)
      ? smoothing * 0.5 // Slower return to normal after falling
      : smoothing;

    // Lerp current values towards targets
    currentVerticalOffset.current = THREE.MathUtils.lerp(
      currentVerticalOffset.current, 
      targetVerticalOffset.current, 
      verticalSmoothing
    );
    currentHorizontalOffset.current = THREE.MathUtils.lerp(
      currentHorizontalOffset.current, 
      targetHorizontalOffset.current, 
      smoothing
    );
    currentRoll.current = THREE.MathUtils.lerp(
      currentRoll.current, 
      targetRoll.current * THREE.MathUtils.DEG2RAD, 
      smoothing
    );
    
    // Pitch uses custom smoothing when transitioning from falling state
    const pitchSmoothing = playerState.state === 'falling' 
      ? config.falling.pitchSpeed 
      : smoothing * 0.8; // Slower smoothing when returning to normal
    
    currentPitch.current = THREE.MathUtils.lerp(
      currentPitch.current, 
      targetPitch.current, 
      pitchSmoothing
    );
    
    // Directional lean smoothing (very smooth)
    const leanSmoothing = config.directionalLean.leanSmoothing;
    currentLeanPitch.current = THREE.MathUtils.lerp(
      currentLeanPitch.current,
      targetLeanPitch.current,
      leanSmoothing
    );
    currentLeanRoll.current = THREE.MathUtils.lerp(
      currentLeanRoll.current,
      targetLeanRoll.current,
      leanSmoothing
    );
    
    // Sneak lowering smoothing
    const sneakSmoothing = config.sneak.lowerTransitionSpeed;
    currentSneakLower.current = THREE.MathUtils.lerp(
      currentSneakLower.current,
      targetSneakLower.current,
      sneakSmoothing
    );

    // FOV uses different smoothing based on state
    const fovSmoothing = playerState.state === 'sprinting' 
      ? config.sprint.fovTransitionSpeed 
      : playerState.state === 'falling'
      ? config.falling.fovTransitionSpeed
      : smoothing;

    currentFOV.current = THREE.MathUtils.lerp(
      currentFOV.current, 
      targetFOV.current, 
      fovSmoothing
    );

    // ========================================
    // APPLY TO CAMERA
    // ========================================

    // Store current camera position (set by PlayerController)
    basePosition.current.copy(camera.position);

    // Apply position offsets (local to camera)
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    right.crossVectors(forward, up).normalize();

    // Apply horizontal offset (side to side)
    camera.position.add(right.multiplyScalar(currentHorizontalOffset.current));
    
    // Apply vertical offset (up and down) including sneak lowering
    camera.position.y += currentVerticalOffset.current - currentSneakLower.current;

    // Send rotation offsets to controls instead of applying directly
    if (onOffsetsUpdate) {
      onOffsetsUpdate({
        pitch: currentPitch.current + currentLeanPitch.current,
        yaw: 0,
        roll: currentRoll.current + currentLeanRoll.current,
      });
    }

    // Apply FOV
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    if (perspectiveCamera.fov !== undefined) {
      perspectiveCamera.fov = currentFOV.current;
      perspectiveCamera.updateProjectionMatrix();
    }
  });

  return null;
}
