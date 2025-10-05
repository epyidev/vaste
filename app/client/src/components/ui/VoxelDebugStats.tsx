/**
 * VoxelDebugStats.tsx - Debug overlay for voxel rendering statistics
 * Shows real-time performance metrics
 */

import { useEffect, useState } from 'react';

interface VoxelDebugStatsProps {
  chunksLoaded: number;
  totalVertices: number;
  totalTriangles: number;
  visible?: boolean;
}

export function VoxelDebugStats({ 
  chunksLoaded, 
  totalVertices, 
  totalTriangles,
  visible = true 
}: VoxelDebugStatsProps) {
  const [fps, setFps] = useState(60);
  const [frameTime, setFrameTime] = useState(16);

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let frameSum = 0;

    const measureFPS = () => {
      const now = performance.now();
      const delta = now - lastTime;
      
      frames++;
      frameSum += delta;

      if (frameSum >= 1000) {
        setFps(Math.round(frames));
        setFrameTime(Math.round(frameSum / frames * 10) / 10);
        frames = 0;
        frameSum = 0;
      }

      lastTime = now;
      requestAnimationFrame(measureFPS);
    };

    measureFPS();
  }, []);

  if (!visible) return null;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '10px 15px',
      borderRadius: '5px',
      userSelect: 'none',
      pointerEvents: 'none',
      minWidth: '200px',
    }}>
      <div style={{ 
        fontSize: '14px', 
        fontWeight: 'bold', 
        marginBottom: '8px',
        color: '#fff',
        borderBottom: '1px solid #444',
        paddingBottom: '5px'
      }}>
        Voxel Rendering Stats
      </div>
      
      <div style={{ marginBottom: '3px' }}>
        <span style={{ color: '#888' }}>FPS:</span>{' '}
        <span style={{ 
          color: fps >= 55 ? '#00ff00' : fps >= 30 ? '#ffff00' : '#ff0000',
          fontWeight: 'bold' 
        }}>
          {fps}
        </span>
      </div>
      
      <div style={{ marginBottom: '3px' }}>
        <span style={{ color: '#888' }}>Frame Time:</span> {frameTime}ms
      </div>
      
      <div style={{ 
        borderTop: '1px solid #444', 
        marginTop: '5px', 
        paddingTop: '5px' 
      }}>
        <div style={{ marginBottom: '3px' }}>
          <span style={{ color: '#888' }}>Chunks:</span> {chunksLoaded}
        </div>
        
        <div style={{ marginBottom: '3px' }}>
          <span style={{ color: '#888' }}>Vertices:</span> {formatNumber(totalVertices)}
        </div>
        
        <div style={{ marginBottom: '3px' }}>
          <span style={{ color: '#888' }}>Triangles:</span> {formatNumber(totalTriangles)}
        </div>
      </div>

      <div style={{ 
        marginTop: '8px',
        fontSize: '10px',
        color: '#666',
        fontStyle: 'italic'
      }}>
        Press F3 to toggle
      </div>
    </div>
  );
}
