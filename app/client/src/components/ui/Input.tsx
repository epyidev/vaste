import React, { useState, InputHTMLAttributes } from 'react';

/**
 * Props for the standardized Input component
 * Extends native HTML input attributes for full compatibility
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Input label displayed above the field */
  label?: string;
  /** Error message to display below the field */
  error?: string;
}

/**
 * Standardized input component matching the design system of PauseMenu/SettingsMenu
 * 
 * Features:
 * - Consistent styling with 2px border and rgba backgrounds
 * - Focus/blur state management with smooth transitions
 * - Optional label and error message support
 * - Full native input attribute support
 * 
 * @example
 * ```tsx
 * <Input 
 *   label="Email" 
 *   type="email" 
 *   placeholder="Enter your email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 * ```
 */
const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  style,
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Container style for label + input + error
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
  };

  // Label style matching PauseMenu/SettingsMenu design
  const labelStyles: React.CSSProperties = {
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
  };

  // Input base style matching the design system
  const inputBaseStyles: React.CSSProperties = {
    padding: '12px 16px',
    background: isFocused 
      ? 'rgba(255, 255, 255, 0.08)' 
      : 'rgba(255, 255, 255, 0.05)',
    border: `2px solid ${isFocused 
      ? 'rgba(255, 255, 255, 0.4)' 
      : error 
        ? 'rgba(239, 68, 68, 0.5)' 
        : 'rgba(255, 255, 255, 0.2)'}`,
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  };

  // Error message style
  const errorStyles: React.CSSProperties = {
    color: 'rgba(239, 68, 68, 0.9)',
    fontSize: '0.875rem',
    marginTop: '-0.25rem',
  };

  // Merge custom styles with base styles
  const mergedStyles: React.CSSProperties = {
    ...inputBaseStyles,
    ...style,
  };

  return (
    <div style={containerStyles}>
      {label && <label style={labelStyles}>{label}</label>}
      <input
        {...props}
        style={mergedStyles}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
      />
      {error && <span style={errorStyles}>{error}</span>}
    </div>
  );
};

export default Input;

