import React, { useState, useEffect, useRef, useCallback } from 'react';

export type ChatVisibilityMode = 'always' | 'on-message' | 'hidden';

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface ChatProps {
  messages: ChatMessage[];
  currentUsername: string;
  onSendMessage: (message: string) => void;
  onVisibilityChange?: (mode: ChatVisibilityMode) => void;
  onChatOpenChange?: (isOpen: boolean) => void;
  onRequestPointerLock?: () => void;
  isInputDisabled?: boolean;
}

export const Chat: React.FC<ChatProps> = ({
  messages,
  currentUsername,
  onSendMessage,
  onVisibilityChange,
  onChatOpenChange,
  onRequestPointerLock,
  isInputDisabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<ChatVisibilityMode>(() => {
    const saved = localStorage.getItem('vaste_chatVisibility');
    return (saved as ChatVisibilityMode) || 'on-message';
  });
  const [inputValue, setInputValue] = useState('');
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Show chat briefly when new message arrives (on-message mode)
  useEffect(() => {
    if (messages.length > 0 && visibilityMode === 'on-message') {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.timestamp > lastMessageTime) {
        setLastMessageTime(latestMessage.timestamp);
        // Don't open the input, just show the messages for 5 seconds
        const timer = setTimeout(() => {
          if (!isOpen) {
            // Messages will fade based on CSS
          }
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, visibilityMode, lastMessageTime, isOpen]);

  // Define handleCloseChat first so it can be used in effects
  const handleCloseChat = useCallback(() => {
    setIsOpen(false);
    setInputValue('');
    inputRef.current?.blur();
    onChatOpenChange?.(false);
    
    // Request pointer lock again after closing chat
    if (onRequestPointerLock) {
      setTimeout(() => {
        onRequestPointerLock();
      }, 50);
    }
  }, [onChatOpenChange, onRequestPointerLock]);

  // Cycle visibility mode with 'L' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        // Only cycle if chat is not open
        if (!isOpen) {
          e.preventDefault();
          const modes: ChatVisibilityMode[] = ['always', 'on-message', 'hidden'];
          const currentIndex = modes.indexOf(visibilityMode);
          const nextMode = modes[(currentIndex + 1) % modes.length];
          setVisibilityMode(nextMode);
          localStorage.setItem('vaste_chatVisibility', nextMode);
          onVisibilityChange?.(nextMode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, visibilityMode, onVisibilityChange]);

  // Handle opening chat with 'T' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 't' || e.key === 'T') && !isOpen && !isInputDisabled) {
        e.preventDefault();
        e.stopPropagation();
        
        // Update state FIRST before unlocking pointer
        setIsOpen(true);
        onChatOpenChange?.(true);
        
        // Exit pointer lock AFTER state update
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        
        // Focus input after state update
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, isInputDisabled, onChatOpenChange]);

  // Handle ESC to close chat
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleCloseChat();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, handleCloseChat]);

  // Block all game input when chat is open
  useEffect(() => {
    if (!isOpen) return;

    const blockGameInput = (e: KeyboardEvent) => {
      // Allow only text input keys, navigation, and special keys
      const allowedKeys = [
        'Escape', 'Enter', 'Backspace', 'Delete', 
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'
      ];

      // Allow all printable characters (space, letters, numbers, symbols)
      const isPrintable = e.key.length === 1;
      
      // Allow Ctrl/Cmd shortcuts for copy/paste
      const isCopyPaste = (e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase());

      if (!allowedKeys.includes(e.key) && !isPrintable && !isCopyPaste) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', blockGameInput, { capture: true });
    window.addEventListener('keyup', blockGameInput, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', blockGameInput, { capture: true });
      window.removeEventListener('keyup', blockGameInput, { capture: true });
    };
  }, [isOpen]);

  const handleSendMessage = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInputValue('');
      handleCloseChat();
    }
  }, [inputValue, onSendMessage, handleCloseChat]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCloseChat();
    }
  };

  // Determine if chat should be visible
  const shouldShowMessages = 
    visibilityMode === 'always' || 
    isOpen || 
    (visibilityMode === 'on-message' && Date.now() - lastMessageTime < 5000);

  const shouldShowContainer = visibilityMode !== 'hidden' || isOpen;

  if (!shouldShowContainer) return null;

  const containerStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    width: '400px',
    maxHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 100,
    pointerEvents: isOpen ? 'auto' : 'none',
  };

  const messagesContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '240px',
    overflowY: 'auto',
    padding: '8px',
    background: isOpen 
      ? 'rgba(0, 0, 0, 0.85)' 
      : 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    borderRadius: '4px',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    opacity: shouldShowMessages ? 1 : 0,
    transition: 'opacity 0.3s ease, background 0.2s ease',
    pointerEvents: 'auto',
  };

  const messageStyles: React.CSSProperties = {
    color: '#ffffff',
    fontSize: '14px',
    lineHeight: '1.4',
    wordWrap: 'break-word',
  };

  const usernameStyles: React.CSSProperties = {
    fontWeight: 'bold',
    marginRight: '6px',
  };

  const inputContainerStyles: React.CSSProperties = {
    display: isOpen ? 'flex' : 'none',
    gap: '8px',
    alignItems: 'center',
    padding: '8px',
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(4px)',
    borderRadius: '4px',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    pointerEvents: 'auto',
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  };

  const inputStyles: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
  };

  const sendButtonStyles: React.CSSProperties = {
    padding: '8px 16px',
    background: '#ffffff',
    color: '#000000',
    border: '2px solid #ffffff',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  };

  const visibilityIndicatorStyles: React.CSSProperties = {
    position: 'absolute',
    top: '-24px',
    left: '0',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '2px 8px',
    background: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '4px',
    opacity: 0,
    animation: 'fadeInOut 2s ease',
  };

  return (
    <div style={containerStyles} ref={chatContainerRef}>
      <style>
        {`
          @keyframes fadeInOut {
            0% { opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}
      </style>

      {/* Messages container */}
      <div style={messagesContainerStyles}>
        {messages.length === 0 ? (
          <div style={{ ...messageStyles, opacity: 0.5, fontStyle: 'italic' }}>
            No messages yet. Press T to chat.
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={messageStyles}>
              <span style={usernameStyles}>{msg.username}:</span>
              <span>{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input container */}
      <div style={inputContainerStyles}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type a message..."
          style={inputStyles}
          maxLength={256}
          onFocus={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            e.target.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.target.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
        />
        <button
          onClick={handleSendMessage}
          style={sendButtonStyles}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e0e0e0';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
};
