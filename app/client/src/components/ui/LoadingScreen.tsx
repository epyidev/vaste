import React from 'react';
import Spinner from './Spinner';

export interface LoadingScreenProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
  overlay?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  progress,
  showProgress = false,
  overlay = false,
}) => {
  const containerStyles: React.CSSProperties = {
    position: overlay ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: overlay ? 9999 : 1000,
    gap: '24px',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '32px',
    letterSpacing: '4px',
  };

  const contentStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  };

  const messageStyles: React.CSSProperties = {
    color: '#cccccc',
    fontSize: '16px',
    fontWeight: '400',
    textAlign: 'center',
    margin: 0,
  };

  const progressBarStyles: React.CSSProperties = {
    width: '300px',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '12px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
  };

  const progressFillStyles: React.CSSProperties = {
    height: '100%',
    background: '#ffffff',
    borderRadius: '2px',
    transition: 'width 0.4s ease-out',
    width: `${Math.min(Math.max(progress || 0, 0), 100)}%`,
  };

  const progressTextStyles: React.CSSProperties = {
    color: '#888888',
    fontSize: '13px',
    marginTop: '8px',
    fontWeight: '400',
  };

  return (
    <div style={containerStyles}>
      <div style={titleStyles}>VASTE</div>
      <div style={contentStyles}>
        <Spinner size="large" color="#ffffff" thickness={3} />
        <p style={messageStyles}>{message}</p>
        
        {showProgress && typeof progress === 'number' && (
          <>
            <div style={progressBarStyles}>
              <div style={progressFillStyles} />
            </div>
            <div style={progressTextStyles}>
              {Math.round(progress)}%
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
