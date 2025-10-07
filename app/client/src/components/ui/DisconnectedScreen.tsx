import React, { useEffect, useState } from 'react';
import { Button } from './Button';

export interface DisconnectedScreenProps {
  reason?: string;
  onReturnToServerList: () => void;
}

export const DisconnectedScreen: React.FC<DisconnectedScreenProps> = ({
  reason = 'Connection lost',
  onReturnToServerList,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(8px)',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 0.3s ease-out',
  };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(-20px)',
    transition: 'opacity 0.3s ease-out 0.1s, transform 0.3s ease-out 0.1s',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: '4px',
    marginBottom: '16px',
  };

  const reasonStyles: React.CSSProperties = {
    fontSize: '18px',
    color: '#cccccc',
    maxWidth: '600px',
    textAlign: 'center',
    lineHeight: '1.6',
    letterSpacing: '0.5px',
  };

  return (
    <div style={overlayStyles}>
      <div style={containerStyles}>
        <div style={titleStyles}>DISCONNECTED</div>
        <div style={reasonStyles}>{reason}</div>
        <Button variant="primary" onClick={onReturnToServerList}>
          RETURN TO SERVER LIST
        </Button>
      </div>
    </div>
  );
};
