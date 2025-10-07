/**
 * View Bobbing Configuration
 * Professional camera animation system for immersive movement feedback
 */

export const VIEW_BOBBING_CONFIG = {
  // Global settings
  enabled: true,
  smoothingFactor: 0.15, // Interpolation speed for smooth transitions (0-1, lower = smoother)

  // Walking bobbing
  walk: {
    // Vertical bobbing (Y-axis)
    verticalAmount: 0.003, // Subtle vertical movement in world units
    verticalFrequency: 4.0, // Cycles per second when at full walk speed

    // Horizontal bobbing (X-axis sway)
    horizontalAmount: 0.002, // Subtle side-to-side movement
    horizontalFrequency: 2.0, // Half the vertical frequency for natural gait

    // Camera roll (Z-axis tilt)
    rollAmount: 1.5, // Degrees of camera roll
    rollFrequency: 2.0, // Synced with horizontal sway

    // FOV animation
    fovAmount: 0.0, // No FOV change for walking
  },

  // Sprinting bobbing
  sprint: {
    // Vertical bobbing (more intense)
    verticalAmount: 0.006, // Reduced amplitude for less shake
    verticalFrequency: 5.0, // Faster cycle for running

    // Horizontal bobbing
    horizontalAmount: 0.005, // Reduced amplitude for less shake
    horizontalFrequency: 2.5,

    // Camera roll (more pronounced)
    rollAmount: 2.0, // More tilt when sprinting
    rollFrequency: 2.5,

    // FOV animation (speed effect)
    fovAmount: 8.0, // Increase FOV by 8 degrees when sprinting
    fovTransitionSpeed: 0.08, // Smooth FOV transition
  },

  // Sneaking bobbing
  sneak: {
    // Vertical bobbing (minimal)
    verticalAmount: 0.0015, // Minimal amplitude
    verticalFrequency: 3.0, // Slower, careful movement

    // Horizontal bobbing
    horizontalAmount: 0.001, // Minimal amplitude
    horizontalFrequency: 1.5,

    // Camera roll (very subtle)
    rollAmount: 0.8,
    rollFrequency: 1.5,

    // FOV animation
    fovAmount: 0.0,
    
    // Camera lowering when sneaking
    cameraLowerAmount: 0.15, // Lower camera by 15cm when sneaking
    lowerTransitionSpeed: 0.1, // Smooth transition speed
  },

  // Falling animation
  falling: {
    // Upward camera drift when falling
    verticalLift: 0.015, // Slow upward drift to simulate floating feeling (reduced from 0.02)
    liftSpeed: 0.015, // How fast the camera drifts up (reduced from 0.02)
    liftMaxSpeed: 8.0, // Maximum falling speed to apply effect (blocks/sec) (increased from 4.0)
    minFallSpeed: 3.0, // Minimum fall speed to trigger effect (blocks/sec) - new parameter

    // Camera tilt when falling
    pitchAmount: 0.5, // Degrees to tilt camera up slightly (reduced from 0.8)
    pitchSpeed: 0.02, // Transition speed (reduced from 0.03)
    maxPitchAngle: 10.0, // Maximum pitch angle cap in degrees (reduced from 12.0)

    // FOV animation (slight expansion when falling fast)
    fovAmount: 1.2, // (reduced from 1.5)
    fovTransitionSpeed: 0.06, // (reduced from 0.08)
  },

  // Landing animation
  landing: {
    // Impact effect when landing
    impactAmount: 0.06, // Subtle downward camera dip on landing
    impactDuration: 0.15, // Quick impact animation
    impactRecovery: 0.2, // Quick recovery
    dampingFactor: 0.85, // Smooth damping to avoid stutters

    // Minimum fall velocity to trigger landing effect (blocks/sec)
    minVelocity: 8.0, // Only trigger on significant falls
  },

  // Jumping animation
  jump: {
    // Smooth camera behavior during jump
    enabled: false, // Disable artificial jump animations, let physics handle it
  },

  // Idle state (no movement)
  idle: {
    // Very subtle breathing animation
    breathingAmount: 0.008, // Tiny vertical movement
    breathingFrequency: 1.5, // Slow breathing cycle per second
    enabled: true, // Can be disabled for completely static camera
  },

  // Directional camera lean (tilt based on movement direction)
  directionalLean: {
    enabled: true,
    
    // Forward/backward tilt
    forwardPitchAmount: 1.0, // Degrees to tilt forward when moving forward
    backwardPitchAmount: 0.8, // Degrees to tilt backward when moving backward
    maxPitchAngle: 1.7, // Maximum pitch angle cap in degrees
    
    // Left/right roll
    strafeRollAmount: 2.7, // Degrees to roll when strafing left/right
    maxRollAngle: 2.7, // Maximum roll angle cap in degrees
    
    // Smoothing
    leanSmoothing: 0.15, // How quickly camera leans into direction (higher = more responsive)
  },
};

// Movement state types for view bobbing
export type MovementState = 'idle' | 'walking' | 'sprinting' | 'sneaking' | 'jumping' | 'falling';

// Player state interface for view bobbing system
export interface PlayerMovementState {
  state: MovementState;
  horizontalSpeed: number; // Current horizontal movement speed (blocks/sec)
  verticalVelocity: number; // Current vertical velocity (blocks/sec)
  isOnGround: boolean;
  isMoving: boolean;
  isSneaking: boolean;
  isSprinting: boolean;
  isJumping: boolean;
  isFalling: boolean;
  
  // Movement direction (normalized input, -1 to 1)
  inputX: number; // Positive = right, negative = left
  inputZ: number; // Positive = backward, negative = forward
}
