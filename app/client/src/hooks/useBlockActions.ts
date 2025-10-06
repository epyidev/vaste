import { useCallback, useRef } from 'react';
import { NetworkManager } from '../network';

interface UseBlockActionsProps {
  networkManager: NetworkManager | null;
}

interface UseBlockActionsReturn {
  breakBlock: (position: [number, number, number]) => void;
  placeBlock: (position: [number, number, number]) => void;
}

export function useBlockActions({ networkManager }: UseBlockActionsProps): UseBlockActionsReturn {
  const lastActionTime = useRef(0);
  const COOLDOWN_MS = 150;

  const breakBlock = useCallback((position: [number, number, number]) => {
    if (!networkManager) return;

    const now = Date.now();
    if (now - lastActionTime.current < COOLDOWN_MS) {
      return;
    }
    lastActionTime.current = now;

    const [x, y, z] = position;
    networkManager.sendBlockBreak(x, y, z);
  }, [networkManager]);

  const placeBlock = useCallback((position: [number, number, number]) => {
    if (!networkManager) return;

    const now = Date.now();
    if (now - lastActionTime.current < COOLDOWN_MS) {
      return;
    }
    lastActionTime.current = now;

    const [x, y, z] = position;
    const blockId = 1;
    
    networkManager.sendBlockPlace(x, y, z, blockId);
  }, [networkManager]);

  return { breakBlock, placeBlock };
}
