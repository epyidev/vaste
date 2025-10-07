import React, { useState, useEffect } from 'react';
import { Slider } from './Slider';
import { ToggleButton } from './ToggleButton';

export interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentRenderDistance: number;
  maxRenderDistance: number;
  onRenderDistanceChange: (value: number) => void;
  forceRenderDistance?: boolean;
  ambientOcclusionEnabled: boolean;
  onAmbientOcclusionChange: (enabled: boolean) => void;
  shadowsEnabled: boolean;
  onShadowsEnabledChange: (enabled: boolean) => void;
  mouseSensitivity: number;
  onMouseSensitivityChange: (value: number) => void;
  cinematicMode: boolean;
  onCinematicModeChange: (enabled: boolean) => void;
  viewBobbingEnabled: boolean;
  onViewBobbingChange: (enabled: boolean) => void;
}

type SettingsTab = 'graphics' | 'mouse' | 'controls';

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  onClose,
  currentRenderDistance,
  maxRenderDistance,
  onRenderDistanceChange,
  forceRenderDistance = false,
  ambientOcclusionEnabled,
  onAmbientOcclusionChange,
  shadowsEnabled,
  onShadowsEnabledChange,
  mouseSensitivity,
  onMouseSensitivityChange,
  cinematicMode,
  onCinematicModeChange,
  viewBobbingEnabled,
  onViewBobbingChange,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('graphics');
  const [localRenderDistance, setLocalRenderDistance] = useState(currentRenderDistance);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalRenderDistance(currentRenderDistance);
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 200);
    }
  }, [isOpen, currentRenderDistance]);

  if (!shouldRender) return null;

  const handleApply = () => {
    onRenderDistanceChange(localRenderDistance);
    onClose();
  };

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
    zIndex: 3000,
    backdropFilter: 'blur(4px)',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 0.2s ease-out',
  };

  const containerStyles: React.CSSProperties = {
    maxWidth: '600px',
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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

  const contentContainerStyles: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.2s ease-out 0.05s, transform 0.2s ease-out 0.05s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
  };

  const tabsContainerStyles: React.CSSProperties = {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
  };

  const tabStyles = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 24px',
    fontSize: '14px',
    fontWeight: '600',
    background: 'transparent',
    color: isActive ? '#ffffff' : '#666666',
    border: 'none',
    borderBottom: isActive ? '2px solid #ffffff' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '1px',
  });

  const settingsContentStyles: React.CSSProperties = {
    width: '100%',
    maxWidth: '500px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  };

  const buttonsContainerStyles: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginTop: '16px',
  };

  const buttonBaseStyles: React.CSSProperties = {
    padding: '16px 48px',
    fontSize: '16px',
    fontWeight: '600',
    border: '2px solid #ffffff',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '200px',
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
    background: 'transparent',
    color: '#ffffff',
  };

  const comingSoonStyles: React.CSSProperties = {
    color: '#666666',
    fontSize: '14px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '60px 0',
  };

  const hintStyles: React.CSSProperties = {
    marginTop: '24px',
    color: '#888888',
    fontSize: '14px',
    letterSpacing: '0.5px',
  };

  return (
    <div style={overlayStyles}>
      <div style={containerStyles}>
        <div style={titleStyles}>SETTINGS</div>
        
        <div style={contentContainerStyles}>
          {/* Tabs */}
          <div style={tabsContainerStyles}>
          <button
            style={tabStyles(activeTab === 'graphics')}
            onClick={() => setActiveTab('graphics')}
            onMouseEnter={(e) => {
              if (activeTab !== 'graphics') {
                e.currentTarget.style.color = '#999999';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'graphics') {
                e.currentTarget.style.color = '#666666';
              }
            }}
          >
            GRAPHICS
          </button>
          <button
            style={tabStyles(activeTab === 'mouse')}
            onClick={() => setActiveTab('mouse')}
            onMouseEnter={(e) => {
              if (activeTab !== 'mouse') {
                e.currentTarget.style.color = '#999999';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'mouse') {
                e.currentTarget.style.color = '#666666';
              }
            }}
          >
            MOUSE
          </button>
          <button
            style={tabStyles(activeTab === 'controls')}
            onClick={() => setActiveTab('controls')}
            onMouseEnter={(e) => {
              if (activeTab !== 'controls') {
                e.currentTarget.style.color = '#999999';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'controls') {
                e.currentTarget.style.color = '#666666';
              }
            }}
          >
            CONTROLS
          </button>
        </div>

        {/* Content */}
        <div style={settingsContentStyles}>
          {activeTab === 'graphics' && (
            <>
              <Slider
                value={localRenderDistance}
                min={2}
                max={maxRenderDistance}
                onChange={setLocalRenderDistance}
                label="RENDER DISTANCE"
                description={`Controls how far you can see. Higher values may impact performance. (Max: ${maxRenderDistance})`}
                disabled={forceRenderDistance}
              />
              
              {/* Shadows Toggle - Maximum Quality */}
              <ToggleButton
                value={shadowsEnabled}
                onChange={onShadowsEnabledChange}
                label="SHADOWS"
                description="Enable dynamic high-quality shadows from the sun (4096px). Disable for better performance."
              />
              
              {/* Ambient Occlusion Toggle */}
              <ToggleButton
                value={ambientOcclusionEnabled}
                onChange={onAmbientOcclusionChange}
                label="AMBIENT OCCLUSION"
                description="Adds realistic shadows in corners and crevices. May impact performance."
              />
              
              {/* View Bobbing Toggle */}
              <ToggleButton
                value={viewBobbingEnabled}
                onChange={onViewBobbingChange}
                label="VIEW BOBBING"
                description="Adds realistic camera movement when walking, running, or jumping. Creates immersive head bobbing and sway effects."
              />
            </>
          )}
          {activeTab === 'mouse' && (
            <>
              <Slider
                value={mouseSensitivity}
                min={0.0005}
                max={0.01}
                step={0.0001}
                onChange={onMouseSensitivityChange}
                label="MOUSE SENSITIVITY"
                description="Controls how fast the camera moves with mouse input. Lower = slower."
              />
              
              <ToggleButton
                value={cinematicMode}
                onChange={onCinematicModeChange}
                label="CINEMATIC MODE"
                description="Adds ultra-smooth camera movement with heavy inertia. Perfect for capturing smooth cinematic footage of your builds. Disable for instant 1:1 raw input (recommended for gameplay)."
              />
            </>
          )}
          {activeTab === 'controls' && (
            <div style={comingSoonStyles}>
              Controls settings coming soon...
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={buttonsContainerStyles}>
          <button
            style={secondaryButtonStyles}
            onClick={() => {
              setLocalRenderDistance(currentRenderDistance);
              onClose();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            CANCEL
          </button>
          <button
            style={primaryButtonStyles}
            onClick={handleApply}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dddddd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            APPLY
          </button>
        </div>

        <div style={hintStyles}>Press ESC to go back</div>
      </div>
      </div>
    </div>
  );
};
