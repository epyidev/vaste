import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SmoothPointerLockControlsProps {
  sensitivity?: number;
  verticalClampDegrees?: number;
  smoothingFactor?: number;
}

export const SmoothPointerLockControls = forwardRef<any, SmoothPointerLockControlsProps>(
  ({ sensitivity = 0.002, verticalClampDegrees = 89, smoothingFactor = 0.3 }, ref) => {
    const { camera, gl } = useThree();
    const isLocked = useRef(false);
    
    // Camera rotation state (in radians)
    const yaw = useRef(0);   // Horizontal rotation
    const pitch = useRef(0); // Vertical rotation
    
    // Target rotation (where we want to go)
    const targetYaw = useRef(0);
    const targetPitch = useRef(0);
    
    // Convert degrees to radians
    const verticalClamp = (verticalClampDegrees * Math.PI) / 180;
    
    // Expose lock/unlock/getObject methods
    useImperativeHandle(ref, () => ({
      lock: () => {
        gl.domElement.requestPointerLock();
      },
      unlock: () => {
        if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock();
        }
      },
      getObject: () => camera,
      isLocked: () => isLocked.current
    }));

    useEffect(() => {
      const handlePointerLockChange = () => {
        isLocked.current = document.pointerLockElement === gl.domElement;
        
        // Initialize rotation from current camera rotation when locking
        if (isLocked.current) {
          const euler = camera.rotation.clone();
          yaw.current = euler.y;
          pitch.current = euler.x;
          targetYaw.current = euler.y;
          targetPitch.current = euler.x;
        }
      };

      const handleMouseMove = (event: MouseEvent) => {
        if (!isLocked.current) return;

        // Get raw mouse movement
        let movementX = event.movementX || 0;
        let movementY = event.movementY || 0;

        // Firefox fix: Firefox reports much higher movement values than other browsers
        // Detect if we're on Firefox and normalize the values
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (isFirefox) {
          // Firefox reports values that are roughly 1.5x higher than Chrome/Edge
          movementX *= 0.65;
          movementY *= 0.65;
        }

        // Clamp to prevent huge spikes (after Firefox normalization)
        movementX = Math.max(-50, Math.min(50, movementX));
        movementY = Math.max(-50, Math.min(50, movementY));

        // Apply sensitivity to target rotation
        targetYaw.current -= movementX * sensitivity;
        targetPitch.current -= movementY * sensitivity;

        // Clamp vertical rotation
        targetPitch.current = Math.max(-verticalClamp, Math.min(verticalClamp, targetPitch.current));
      };

      // Smooth interpolation loop
      const updateRotation = () => {
        if (isLocked.current) {
          // Smoothly interpolate current rotation towards target
          yaw.current = THREE.MathUtils.lerp(yaw.current, targetYaw.current, smoothingFactor);
          pitch.current = THREE.MathUtils.lerp(pitch.current, targetPitch.current, smoothingFactor);

          // Apply rotation to camera
          camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
        }
        requestAnimationFrame(updateRotation);
      };
      
      const animationId = requestAnimationFrame(updateRotation);

      document.addEventListener('pointerlockchange', handlePointerLockChange);
      document.addEventListener('mousemove', handleMouseMove);

      return () => {
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
        document.removeEventListener('mousemove', handleMouseMove);
        cancelAnimationFrame(animationId);
      };
    }, [camera, gl.domElement, sensitivity, verticalClamp, smoothingFactor]);

    return null;
  }
);

SmoothPointerLockControls.displayName = 'SmoothPointerLockControls';
