import React from 'react';
import Spinner from './Spinner';

export interface LoadingStep {
  name: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  detail?: string;
}

export interface LoadingScreenProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
  overlay?: boolean;
  steps?: LoadingStep[];
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  progress,
  showProgress = false,
  overlay = false,
  steps = [],
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

  const stepsContainerStyles: React.CSSProperties = {
    marginTop: '32px',
    width: '400px',
    maxWidth: '90vw',
  };

  const stepItemStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transition: 'all 0.3s ease',
  };

  const getStepIcon = (status: LoadingStep['status']): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'loading':
        return '⟳';
      case 'error':
        return '✗';
      case 'pending':
      default:
        return '○';
    }
  };

  const getStepColor = (status: LoadingStep['status']): string => {
    switch (status) {
      case 'completed':
        return '#4ade80'; // Green
      case 'loading':
        return '#60a5fa'; // Blue
      case 'error':
        return '#f87171'; // Red
      case 'pending':
      default:
        return '#6b7280'; // Gray
    }
  };

  const stepIconStyles = (status: LoadingStep['status']): React.CSSProperties => ({
    fontSize: '18px',
    color: getStepColor(status),
    fontWeight: 'bold',
    minWidth: '24px',
    textAlign: 'center',
    animation: status === 'loading' ? 'spin 1s linear infinite' : 'none',
  });

  const stepTextStyles = (status: LoadingStep['status']): React.CSSProperties => ({
    flex: 1,
    fontSize: '14px',
    color: status === 'completed' ? '#ffffff' : status === 'loading' ? '#e5e7eb' : '#9ca3af',
    fontWeight: status === 'loading' ? '500' : '400',
  });

  const stepDetailStyles: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
  };

  return (
    <div style={containerStyles}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      
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

      {/* Steps List */}
      {steps.length > 0 && (
        <div style={stepsContainerStyles}>
          {steps.map((step, index) => (
            <div key={index} style={stepItemStyles}>
              <span style={stepIconStyles(step.status)}>
                {getStepIcon(step.status)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={stepTextStyles(step.status)}>
                  {step.name}
                </div>
                {step.detail && (
                  <div style={stepDetailStyles}>
                    {step.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
