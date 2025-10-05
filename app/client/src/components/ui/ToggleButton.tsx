import React from 'react';

export interface ToggleButtonProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  value,
  onChange,
  label,
  description,
}) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  };

  const rowStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '32px',
  };

  const labelContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  };

  const labelStyles: React.CSSProperties = {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '0.5px',
  };

  const descriptionStyles: React.CSSProperties = {
    color: '#888888',
    fontSize: '13px',
    letterSpacing: '0.3px',
  };

  const buttonBaseStyles: React.CSSProperties = {
    padding: '8px 24px',
    fontSize: '14px',
    fontWeight: '600',
    border: '2px solid',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '80px',
    letterSpacing: '1px',
  };

  const buttonActiveStyles: React.CSSProperties = {
    ...buttonBaseStyles,
    background: '#4CAF50',
    borderColor: '#4CAF50',
    color: '#ffffff',
  };

  const buttonInactiveStyles: React.CSSProperties = {
    ...buttonBaseStyles,
    background: 'transparent',
    borderColor: '#666666',
    color: '#666666',
  };

  return (
    <div style={containerStyles}>
      <div style={rowStyles}>
        {(label || description) && (
          <div style={labelContainerStyles}>
            {label && <div style={labelStyles}>{label}</div>}
            {description && <div style={descriptionStyles}>{description}</div>}
          </div>
        )}
        <button
          style={value ? buttonActiveStyles : buttonInactiveStyles}
          onClick={() => onChange(!value)}
        >
          {value ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
