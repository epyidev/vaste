import React, { useEffect, useState } from 'react';
import { Button } from './Button';

interface PauseMenuProps {
  isOpen: boolean;
  onResume: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  onResume,
  onDisconnect,
  onOpenSettings,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 200);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    backdropFilter: 'blur(4px)',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 0.2s ease-out',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '48px',
    letterSpacing: '4px',
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
  };

  const menuStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.2s ease-out 0.05s, transform 0.2s ease-out 0.05s',
  };

  return (
    <div style={overlayStyles}>
      <div style={titleStyles}>PAUSED</div>
      <div style={menuStyles}>
        <Button variant="primary" onClick={onResume} style={{ width: '240px' }}>
          BACK TO GAME
        </Button>
        <Button variant="secondary" onClick={onOpenSettings} style={{ width: '240px' }}>
          SETTINGS
        </Button>
        <Button variant="secondary" onClick={onDisconnect} style={{ width: '240px' }}>
          DISCONNECT
        </Button>
      </div>
    </div>
  );
};
