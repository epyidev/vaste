/**
 * Movement and physics configuration
 * Values tuned to match Minecraft-like feel
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
  airControl: 0.2,

  // Acceleration (much higher for instant response)
  groundAcceleration: 100.0,
  airAcceleration: 20.0,

  // Friction (applied per frame, not per second)
  groundFriction: 0.5,
  airFriction: 0.98,

  // Gravity and jumping - tuned for Minecraft-like feel
  gravity: 32.0,
  jumpVelocity: 8.0,

  // Step height (auto-climb blocks)
  stepHeight: 0.6,
};
