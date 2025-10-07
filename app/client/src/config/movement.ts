/**
 * Movement and physics configuration
 * Système de momentum de sauts enchaînés
 */

export const PHYSICS_CONFIG = {
  // Player dimensions
  playerWidth: 0.6,
  playerHeight: 1.8,
  playerEyeHeight: 1.62,

  // Movement speeds (blocks per second)
  walkSpeed: 4.3,
  sprintSpeed: 5.8, // Adjusted for 4-block jump distance
  sneakSpeed: 2.295,

  // Acceleration (blocks per second²)
  groundAcceleration: 50.0,
  airAcceleration: 10.0,

  // Friction (coefficient per second)
  airFrictionPerSecond: 0.98, // Reduced friction to maintain momentum better

  // Gravity and jumping (blocks per second)
  gravity: 32,
  jumpVelocity: 8.4,
  
  // Sprint jump mechanics
  sprintJumpBoost: 0.35, // Adjusted for proper 4-block distance
  sprintJumpMinSpeed: 5.0, // Minimum horizontal speed to trigger sprint jump boost

  // Momentum retention for chained jumps
  momentumRetain: 1.0, // Keep 100% of horizontal momentum when jumping
  sneakJumpMomentumRetain: 0.6, // Reduced horizontal momentum when sneaking (jump height stays same)

  // Step height (auto-climb blocks)
  stepHeight: 0.6,

  // Edge detection
  edgeSlowdownFactor: 0.5, // Speed multiplier when at edge while sneaking
};
