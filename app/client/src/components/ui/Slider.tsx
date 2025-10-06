import React, { useState, useRef, useEffect } from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  description,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateValue = (clientX: number) => {
    if (!sliderRef.current || disabled) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const rawValue = min + percentage * (max - min);
    // Round to nearest step
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    
    onChange(clampedValue);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    updateValue(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      updateValue(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const percentage = ((value - min) / (max - min)) * 100;

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  };

  const labelStyles: React.CSSProperties = {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '0.5px',
  };

  const sliderContainerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  };

  const sliderTrackWrapperStyles: React.CSSProperties = {
    flex: 1,
    padding: '12px 0', // Zone de hit plus large
    cursor: disabled ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
    userSelect: 'none',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.2s ease',
  };

  const sliderTrackStyles: React.CSSProperties = {
    height: '4px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '2px',
    position: 'relative',
    transition: 'background 0.2s ease',
  };

  const sliderFillStyles: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: '#ffffff',
    borderRadius: '2px',
    width: `${percentage}%`,
    transition: isDragging ? 'none' : 'width 0.15s ease-out',
    pointerEvents: 'none',
  };

  const sliderThumbStyles: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: `${percentage}%`,
    transform: `translate(-50%, -50%) scale(${isDragging ? 1.3 : isHovering ? 1.15 : 1})`,
    width: '20px',
    height: '20px',
    background: '#ffffff',
    borderRadius: '50%',
    pointerEvents: 'none',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    transition: isDragging ? 'box-shadow 0.15s ease' : 'all 0.15s ease-out',
  };

  const valueDisplayStyles: React.CSSProperties = {
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 'bold',
    minWidth: '60px',
    textAlign: 'center',
    letterSpacing: '0.5px',
    transition: 'transform 0.2s ease',
    transform: isDragging ? 'scale(1.05)' : 'scale(1)',
  };

  const descriptionStyles: React.CSSProperties = {
    color: '#888888',
    fontSize: '13px',
    letterSpacing: '0.3px',
  };

  const lockedMessageStyles: React.CSSProperties = {
    color: '#ff6b6b',
    fontSize: '12px',
    letterSpacing: '0.3px',
    marginTop: '-4px',
    fontStyle: 'italic',
  };

  return (
    <div style={containerStyles}>
      {label && <div style={labelStyles}>{label}</div>}
      
      <div style={sliderContainerStyles}>
        <div 
          style={sliderTrackWrapperStyles}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => !disabled && setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div ref={sliderRef} style={sliderTrackStyles}>
            <div style={sliderFillStyles} />
            <div style={sliderThumbStyles} />
          </div>
        </div>
        <div style={valueDisplayStyles}>
          {step < 1 ? value.toFixed(4) : value}
        </div>
      </div>

      {description && <div style={descriptionStyles}>{description}</div>}
      {disabled && <div style={lockedMessageStyles}>Server does not allow render distance modification</div>}
    </div>
  );
};
