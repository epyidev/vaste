import React, { useMemo } from 'react';
import { EdgesGeometry, BoxGeometry } from 'three';

interface BlockOutlineProps {
  position: [number, number, number];
}

export const BlockOutline: React.FC<BlockOutlineProps> = ({ position }) => {
  const edgesGeometry = useMemo(() => {
    const boxGeometry = new BoxGeometry(1.001, 1.001, 1.001);
    return new EdgesGeometry(boxGeometry);
  }, []);

  // Blocks are rendered from (x,y,z) to (x+1,y+1,z+1)
  // So the center of the block is at (x+0.5, y+0.5, z+0.5)
  const centeredPosition: [number, number, number] = [
    position[0] + 0.5,
    position[1] + 0.5,
    position[2] + 0.5
  ];

  return (
    <lineSegments position={centeredPosition} geometry={edgesGeometry}>
      <lineBasicMaterial 
        color="#ffffff"
        transparent
        opacity={0.4}
        depthTest={true}
      />
    </lineSegments>
  );
};

export default BlockOutline;
