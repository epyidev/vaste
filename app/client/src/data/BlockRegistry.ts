/**
 * Block Registry - String-Based Block System
 * 
 * DEVELOPER-FACING: Use string IDs only!
 * - To add a block: just use "namespace:name" format (e.g., "vaste:stone", "mymod:ruby")
 * - NO manual numeric IDs needed
 * 
 * INTERNAL SYSTEM (automatic):
 * - Numeric IDs are generated at runtime for network efficiency
 * - Client/server sync mapping table at connection
 * - World storage uses string IDs (future-proof, no conflicts)
 * 
 * String ID format: "namespace:blockname"
 * - Official blocks: "vaste:stone", "vaste:dirt", etc.
 * - Mod blocks: "mymod:custom_block", "othermod:special_ore", etc.
 * 
 * The mapping system (BlockMappingManager) handles:
 * - Auto-generation of temporary numeric IDs (for network packets)
 * - Synchronization between client and server
 * - Persistence of string IDs in world files
 */

export interface BlockDefinition {
  stringId: string;        // ONLY ID you need! e.g., "vaste:stone", "mymod:ruby"
  name: string;            // Internal name (e.g., "stone", "dirt")
  displayName: string;     // Human-readable name
  solid: boolean;
  transparent: boolean;
}

/**
 * Official block registry - Map<stringId, BlockDefinition>
 * Add blocks here using ONLY string IDs
 */
export const BLOCK_REGISTRY = new Map<string, BlockDefinition>([
  ["vaste:air", {
    stringId: "vaste:air",
    name: "air",
    displayName: "Air",
    solid: false,
    transparent: true,
  }],
  ["vaste:stone", {
    stringId: "vaste:stone",
    name: "stone",
    displayName: "Stone",
    solid: true,
    transparent: false,
  }],
  ["vaste:dirt", {
    stringId: "vaste:dirt",
    name: "dirt",
    displayName: "Dirt",
    solid: true,
    transparent: false,
  }],
  ["vaste:grass", {
    stringId: "vaste:grass",
    name: "grass",
    displayName: "Grass",
    solid: true,
    transparent: false,
  }],
  ["vaste:wood", {
    stringId: "vaste:wood",
    name: "wood",
    displayName: "Wood",
    solid: true,
    transparent: false,
  }],
  ["vaste:sand", {
    stringId: "vaste:sand",
    name: "sand",
    displayName: "Sand",
    solid: true,
    transparent: false,
  }],
]);

/**
 * BlockMappingManager - Handles runtime numeric ID assignment
 * 
 * This manager provides bidirectional mapping between string IDs and temporary numeric IDs.
 * Numeric IDs are ONLY used for network efficiency (2 bytes vs variable-length strings).
 * 
 * The mapping table is synchronized from server to client at connection time.
 */
export class BlockMappingManager {
  private stringToNumeric: Map<string, number> = new Map();
  private numericToString: Map<number, string> = new Map();
  private nextNumericId: number = 1; // 0 reserved for air

  constructor() {
    // Pre-register official blocks
    this.registerBlock("vaste:air", 0); // Air always gets ID 0
    
    // Auto-register all official blocks with sequential IDs
    for (const [stringId, _] of BLOCK_REGISTRY) {
      if (stringId !== "vaste:air") {
        this.registerBlock(stringId);
      }
    }
  }

  /**
   * Register a block and assign it a numeric ID
   * @param stringId String ID (e.g., "vaste:stone", "mymod:ruby")
   * @param forcedNumericId Optional: force a specific numeric ID (for server sync)
   * @returns The assigned numeric ID
   */
  registerBlock(stringId: string, forcedNumericId?: number): number {
    // Check if already registered
    const existing = this.stringToNumeric.get(stringId);
    if (existing !== undefined) {
      return existing;
    }

    // Assign numeric ID
    const numericId = forcedNumericId !== undefined ? forcedNumericId : this.nextNumericId++;
    
    // Update both mappings
    this.stringToNumeric.set(stringId, numericId);
    this.numericToString.set(numericId, stringId);
    
    // Update next available ID
    if (numericId >= this.nextNumericId) {
      this.nextNumericId = numericId + 1;
    }

    return numericId;
  }

  /**
   * Get numeric ID from string ID
   */
  getNumericId(stringId: string): number {
    const numericId = this.stringToNumeric.get(stringId);
    if (numericId === undefined) {
      console.warn(`[BlockMapping] Unknown string ID: ${stringId}, returning 0 (air)`);
      return 0; // Fallback to air
    }
    return numericId;
  }

  /**
   * Get string ID from numeric ID
   */
  getStringId(numericId: number): string {
    const stringId = this.numericToString.get(numericId);
    if (stringId === undefined) {
      console.warn(`[BlockMapping] Unknown numeric ID: ${numericId}, returning vaste:air`);
      return "vaste:air"; // Fallback to air
    }
    return stringId;
  }

  /**
   * Load mapping table from server (called at connection)
   */
  loadMappingTable(mappingTable: { stringId: string; numericId: number }[]): void {
    console.log(`[BlockMapping] Loading ${mappingTable.length} block mappings from server`);
    
    // Clear existing mappings
    this.stringToNumeric.clear();
    this.numericToString.clear();
    this.nextNumericId = 1;

    // Load server mappings
    for (const { stringId, numericId } of mappingTable) {
      this.registerBlock(stringId, numericId);
    }

    console.log(`[BlockMapping] Loaded mappings:`, Array.from(this.stringToNumeric.entries()));
  }

  /**
   * Export current mapping table (for server sync)
   */
  exportMappingTable(): { stringId: string; numericId: number }[] {
    return Array.from(this.stringToNumeric.entries()).map(([stringId, numericId]) => ({
      stringId,
      numericId,
    }));
  }

  /**
   * Get all registered string IDs
   */
  getAllStringIds(): string[] {
    return Array.from(this.stringToNumeric.keys());
  }
}

// Global mapping manager instance
export const blockMapping = new BlockMappingManager();

// ============================================================================
// Helper Functions (for compatibility with existing code)
// ============================================================================

/**
 * Get block definition by string ID
 */
export function getBlockDefinition(stringId: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY.get(stringId);
}

/**
 * Get block internal name from string ID
 */
export function getBlockName(stringIdOrNumeric: string | number): string {
  const stringId = typeof stringIdOrNumeric === 'number' 
    ? blockMapping.getStringId(stringIdOrNumeric)
    : stringIdOrNumeric;
    
  const block = BLOCK_REGISTRY.get(stringId);
  return block?.name || "air";
}

/**
 * Get block display name
 */
export function getBlockDisplayName(stringIdOrNumeric: string | number): string {
  const stringId = typeof stringIdOrNumeric === 'number'
    ? blockMapping.getStringId(stringIdOrNumeric)
    : stringIdOrNumeric;
    
  const block = BLOCK_REGISTRY.get(stringId);
  return block?.displayName || "Unknown";
}

/**
 * Check if block is solid
 */
export function isBlockSolid(stringIdOrNumeric: string | number): boolean {
  const stringId = typeof stringIdOrNumeric === 'number'
    ? blockMapping.getStringId(stringIdOrNumeric)
    : stringIdOrNumeric;
    
  const block = BLOCK_REGISTRY.get(stringId);
  return block?.solid || false;
}

/**
 * Check if block is transparent
 */
export function isBlockTransparent(stringIdOrNumeric: string | number): boolean {
  const stringId = typeof stringIdOrNumeric === 'number'
    ? blockMapping.getStringId(stringIdOrNumeric)
    : stringIdOrNumeric;
    
  const block = BLOCK_REGISTRY.get(stringId);
  return block?.transparent || true;
}

/**
 * Get all block definitions
 */
export function getAllBlocks(): BlockDefinition[] {
  return Array.from(BLOCK_REGISTRY.values());
}

/**
 * Register a new block (for mods)
 */
export function registerBlock(definition: BlockDefinition): number {
  BLOCK_REGISTRY.set(definition.stringId, definition);
  return blockMapping.registerBlock(definition.stringId);
}

console.log('[BlockRegistry] Initialized with string-based system');
console.log(`[BlockRegistry] Registered ${BLOCK_REGISTRY.size} official blocks`);
console.log('[BlockRegistry] Block mappings:', blockMapping.exportMappingTable());
