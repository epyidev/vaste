import React, { useEffect, useState } from 'react';

interface PauseMenuProps {
  isOpen: boolean;
  onResume: () => void;
  onDisconnect: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  onResume,
  onDisconnect,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Start rendering, then fade in
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      // Fade out, then stop rendering
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

  const buttonBaseStyles: React.CSSProperties = {
    padding: '16px 48px',
    fontSize: '16px',
    fontWeight: '600',
    border: '2px solid #ffffff',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: 'transparent',
    color: '#ffffff',
    minWidth: '250px',
    textAlign: 'center',
    letterSpacing: '1px',
  };

  const primaryButtonStyles: React.CSSProperties = {
    ...buttonBaseStyles,
    background: '#ffffff',
    color: '#000000',
  };

  const secondaryButtonStyles: React.CSSProperties = {
    ...buttonBaseStyles,
  };

  const hintStyles: React.CSSProperties = {
    marginTop: '32px',
    color: '#888888',
    fontSize: '14px',
    letterSpacing: '0.5px',
  };

  return (
    <div style={overlayStyles}>
      <div style={titleStyles}>PAUSED</div>
      <div style={menuStyles}>
        <button
          style={primaryButtonStyles}
          onClick={onResume}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dddddd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
          }}
        >
          BACK TO GAME
        </button>
        <button
          style={secondaryButtonStyles}
          onClick={onDisconnect}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          DISCONNECT
        </button>
      </div>
      <div style={hintStyles}>Press ESC to resume</div>
    </div>
  );
};
