/**
 * Calculate ambient occlusion value for a vertex (PROFESSIONAL VOXEL SYSTEM)
 * Uses proper vertex-based AO with sharp contrast for clean voxel aesthetics
 * @returns AO value between 0.25 (darkest corner) and 1.0 (fully lit)
 */
export function calculateVertexAO(
  side1: boolean,
  side2: boolean,
  corner: boolean
): number {
  // Both adjacent sides blocked = darkest (hard corner)
  if (side1 && side2) {
    return 0.25; // Maximum occlusion - deep shadow in corners
  }

  // Count total occlusion from adjacent blocks
  const occludedCount = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);

  // Professional voxel AO levels with sharp contrast
  switch (occludedCount) {
    case 0:
      return 1.0; // Fully exposed vertex - maximum brightness
    case 1:
      return 0.75; // One neighbor - slight shadow
    case 2:
      return 0.5; // Two neighbors - medium shadow
    case 3:
      return 0.35; // Three neighbors - dark shadow
    default:
      return 1.0;
  }
}

/**
 * Calculate AO for all 4 vertices of a face (PROFESSIONAL VOXEL SYSTEM)
 * Each vertex checks its 3 neighboring blocks for precise per-vertex occlusion
 * @returns Array of 4 AO values matching the vertex order of the face
 */
export function calculateFaceAO(
  isSolid: (x: number, y: number, z: number) => boolean,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  faceName: string
): [number, number, number, number] {
  // Determine the two tangent directions based on face normal
  let dx1 = 0, dy1 = 0, dz1 = 0;
  let dx2 = 0, dy2 = 0, dz2 = 0;

  if (ny !== 0) {
    // Horizontal face (top/bottom) - tangents along X and Z
    dx1 = 1;
    dz2 = 1;
  } else if (nx !== 0) {
    // Vertical face along X axis (east/west) - tangents along Y and Z
    dy1 = 1;
    dz2 = 1;
  } else {
    // Vertical face along Z axis (north/south) - tangents along X and Y
    dx1 = 1;
    dy2 = 1;
  }

  // Sample all 8 neighboring blocks around the face
  // s = side neighbors, c = corner neighbors
  const blocks = {
    s1: isSolid(x + nx + dx1, y + ny + dy1, z + nz + dz1),     // +dx1/+dy1/+dz1
    s2: isSolid(x + nx + dx2, y + ny + dy2, z + nz + dz2),     // +dx2/+dy2/+dz2
    s3: isSolid(x + nx - dx1, y + ny - dy1, z + nz - dz1),     // -dx1/-dy1/-dz1
    s4: isSolid(x + nx - dx2, y + ny - dy2, z + nz - dz2),     // -dx2/-dy2/-dz2
    c1: isSolid(x + nx + dx1 + dx2, y + ny + dy1 + dy2, z + nz + dz1 + dz2), // ++
    c2: isSolid(x + nx + dx1 - dx2, y + ny + dy1 - dy2, z + nz + dz1 - dz2), // +-
    c3: isSolid(x + nx - dx1 + dx2, y + ny - dy1 + dy2, z + nz - dz1 + dz2), // -+
    c4: isSolid(x + nx - dx1 - dx2, y + ny - dy1 - dy2, z + nz - dz1 - dz2), // --
  };

  // Calculate base AO values for the 4 corners
  // Standard orientation: [+dx1+dx2, +dx1-dx2, -dx1-dx2, -dx1+dx2]
  const ao = [
    calculateVertexAO(blocks.s1, blocks.s2, blocks.c1), // Corner ++
    calculateVertexAO(blocks.s1, blocks.s4, blocks.c2), // Corner +-
    calculateVertexAO(blocks.s3, blocks.s4, blocks.c4), // Corner --
    calculateVertexAO(blocks.s3, blocks.s2, blocks.c3), // Corner -+
  ];

  // Map AO values to match actual vertex order for each face
  // Each face has vertices in different order due to winding
  switch (faceName) {
    case 'top':
      // Top vertices: [0,1,1], [1,1,1], [1,1,0], [0,1,0]
      // Order: [-X+Z], [+X+Z], [+X-Z], [-X-Z]
      return [ao[3], ao[0], ao[1], ao[2]]; // Rotate to match vertex order
      
    case 'bottom':
      // Bottom vertices: [0,0,0], [1,0,0], [1,0,1], [0,0,1]
      // Order: [-X-Z], [+X-Z], [+X+Z], [-X+Z]
      return [ao[2], ao[1], ao[0], ao[3]]; // Rotate to match vertex order
      
    case 'east':
      // East vertices: [1,0,1], [1,0,0], [1,1,0], [1,1,1]
      // Order: [-Y+Z], [-Y-Z], [+Y-Z], [+Y+Z]
      return [ao[3], ao[2], ao[1], ao[0]]; // Rotate to match vertex order
      
    case 'west':
      // West vertices: [0,0,0], [0,0,1], [0,1,1], [0,1,0]
      // Order: [-Y-Z], [-Y+Z], [+Y+Z], [+Y-Z]
      return [ao[2], ao[3], ao[0], ao[1]]; // Rotate to match vertex order
      
    case 'south':
      // South vertices: [0,0,1], [1,0,1], [1,1,1], [0,1,1]
      // Order: [-X-Y], [+X-Y], [+X+Y], [-X+Y]
      return [ao[2], ao[1], ao[0], ao[3]]; // Rotate to match vertex order
      
    case 'north':
      // North vertices: [1,0,0], [0,0,0], [0,1,0], [1,1,0]
      // Order: [+X-Y], [-X-Y], [-X+Y], [+X+Y]
      return [ao[1], ao[2], ao[3], ao[0]]; // Rotate to match vertex order
      
    default:
      return [ao[0], ao[1], ao[2], ao[3]];
  }
}

/**
 * Calculate directional shading multiplier based on face orientation
 * Provides base lighting that simulates sunlight from above
 * @returns Brightness multiplier (0.5 to 1.0)
 */
export function calculateDirectionalShading(faceName: string): number {
  switch (faceName) {
    case 'top':
      return 1.0;  // Full brightness - facing the sun
    case 'bottom':
      return 0.5;  // Darkest - no direct light
    case 'north':
    case 'south':
      return 0.8;  // Medium-bright - side lighting
    case 'east':
    case 'west':
      return 0.7;  // Medium-dark - less side lighting
    default:
      return 0.8;
  }
}
