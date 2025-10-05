/**
 * Calculate ambient occlusion value for a vertex
 * @returns AO value between 0.0 (full shadow) and 1.0 (no shadow)
 */
export function calculateVertexAO(
  side1: boolean,
  side2: boolean,
  corner: boolean
): number {
  if (side1 && side2) {
    return 0.0; // Fully occluded
  }

  const occludedSides = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);

  // Map to brightness levels
  switch (occludedSides) {
    case 0:
      return 1.0; // No occlusion
    case 1:
      return 0.8; // Slight shadow
    case 2:
      return 0.6; // Medium shadow
    case 3:
      return 0.4; // Dark shadow
    default:
      return 1.0;
  }
}

/**
 * Calculate AO for all 4 vertices of a face
 * Returns array of 4 AO values (one per vertex)
 */
export function calculateFaceAO(
  isSolid: (x: number, y: number, z: number) => boolean,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number
): [number, number, number, number] {
  // Determine the two tangent directions
  let dx1 = 0,
    dy1 = 0,
    dz1 = 0;
  let dx2 = 0,
    dy2 = 0,
    dz2 = 0;

  if (ny !== 0) {
    // Top or bottom face
    dx1 = 1;
    dz2 = 1;
  } else if (nx !== 0) {
    // Left or right face
    dy1 = 1;
    dz2 = 1;
  } else {
    // Front or back face
    dx1 = 1;
    dy2 = 1;
  }

  // Get the 8 surrounding blocks
  const blocks = {
    s1: isSolid(x + nx + dx1, y + ny + dy1, z + nz + dz1),
    s2: isSolid(x + nx + dx2, y + ny + dy2, z + nz + dz2),
    s3: isSolid(x + nx - dx1, y + ny - dy1, z + nz - dz1),
    s4: isSolid(x + nx - dx2, y + ny - dy2, z + nz - dz2),
    c1: isSolid(x + nx + dx1 + dx2, y + ny + dy1 + dy2, z + nz + dz1 + dz2),
    c2: isSolid(x + nx + dx1 - dx2, y + ny + dy1 - dy2, z + nz + dz1 - dz2),
    c3: isSolid(x + nx - dx1 + dx2, y + ny - dy1 + dy2, z + nz - dz1 + dz2),
    c4: isSolid(x + nx - dx1 - dx2, y + ny - dy1 - dy2, z + nz - dz1 - dz2),
  };

  // Calculate AO for each vertex
  return [
    calculateVertexAO(blocks.s1, blocks.s2, blocks.c1), // Vertex 0
    calculateVertexAO(blocks.s1, blocks.s4, blocks.c2), // Vertex 1
    calculateVertexAO(blocks.s3, blocks.s4, blocks.c4), // Vertex 2
    calculateVertexAO(blocks.s3, blocks.s2, blocks.c3), // Vertex 3
  ];
}
