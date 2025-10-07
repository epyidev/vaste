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
  sprintSpeed: 5.6,
  sneakSpeed: 2.295,

  // Acceleration (blocks per second²)
  groundAcceleration: 50.0,
  airAcceleration: 10.0,

  // Friction (coefficient par seconde)
  airFrictionPerSecond: 0.91,

  // Gravity and jumping (blocks per second)
  gravity: 32,
  jumpVelocity: 8.4,

  // Momentum retention for chained jumps
  momentumRetain: 0.85,
  sneakJumpMomentumRetain: 0.4, // Reduced horizontal momentum when sneaking (jump height stays same)

  // Step height (auto-climb blocks)
  stepHeight: 0.6,

  // Edge detection
  edgeSlowdownFactor: 0.5, // Speed multiplier when at edge while sneaking
};
