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
  walkSpeed: 4.3,       // MAX_WALK_SPEED
  sprintSpeed: 5.6,     // MAX_RUN_SPEED
  sneakSpeed: 1.295,

  // Acceleration (blocks per second²)
  groundAcceleration: 50.0,  // GROUND_ACCEL - accélération forte au sol
  airAcceleration: 10.0,      // AIR_ACCEL - contrôle limité en l'air

  // Friction (coefficient par seconde)
  // Note: sera converti en coefficient par frame dans le controller
  airFrictionPerSecond: 0.91,  // AIR_FRICTION - friction horizontale en l'air

  // Gravity and jumping (blocks per second)
  gravity: 32,           // GRAVITY
  jumpVelocity: 8.4,        // JUMP_VELOCITY

  // Momentum retention for chained jumps
  momentumRetain: 0.85,     // MOMENTUM_RETAIN - conservation du momentum entre sauts

  // Step height (auto-climb blocks)
  stepHeight: 0.6,
};
