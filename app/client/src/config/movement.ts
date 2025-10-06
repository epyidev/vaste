/**
 * Movement and physics configuration
 */

export const PHYSICS_CONFIG = {
  // Player dimensions
  playerWidth: 0.6,
  playerHeight: 1.8,
  playerEyeHeight: 1.62,

  // Movement speeds (blocks per second)
  walkSpeed: 4.317,
  sprintSpeed: 5.612,
  sneakSpeed: 1.295,

  // Air control (percentage of ground control)
  // Can barely adjust trajectory in air
  airControl: 0.02,

  // Acceleration (much higher for instant response)
  groundAcceleration: 100.0,
  airAcceleration: 1.0, // Very limited for realistic air control

  // Friction (applied per frame, not per second)
  groundFriction: 0.5,
  airFriction: 0.99, // Very low air friction to preserve momentum

  // Gravity and jumping
  // Jump velocity of 9.0 allows jumping exactly 1.25 blocks
  gravity: 32.0,
  jumpVelocity: 9.0,

  // Step height (auto-climb blocks)
  stepHeight: 0.6,
};
