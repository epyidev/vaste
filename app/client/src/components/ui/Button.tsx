import React, { useState } from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  style = {},
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const buttonBaseStyles: React.CSSProperties = {
    padding: '16px 48px',
    fontSize: '16px',
    fontWeight: '600',
    border: '2px solid #ffffff',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    minWidth: fullWidth ? '100%' : '200px',
    textAlign: 'center',
    letterSpacing: '1px',
    opacity: disabled ? 0.5 : 1,
  };

  const primaryButtonStyles: React.CSSProperties = {
    ...buttonBaseStyles,
    background: isHovered && !disabled ? '#e0e0e0' : '#ffffff',
    color: '#000000',
    transform: isHovered && !disabled ? 'scale(1.02)' : 'scale(1)',
  };

  const secondaryButtonStyles: React.CSSProperties = {
    ...buttonBaseStyles,
    background: isHovered && !disabled ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    color: '#ffffff',
  };

  const getStyles = () => {
    return variant === 'primary' ? primaryButtonStyles : secondaryButtonStyles;
  };

  return (
    <button
      style={{ ...getStyles(), ...style }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
