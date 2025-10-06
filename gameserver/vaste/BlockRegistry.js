/**
 * BlockRegistry - Server-side String-Based Block System
 * 
 * DEVELOPER-FACING: Use string IDs only!
 * - To add a block: just use "namespace:name" format (e.g., "vaste:stone", "mymod:ruby")
 * - NO manual numeric IDs needed
 * 
 * INTERNAL SYSTEM (automatic):
 * - Numeric IDs are generated at runtime for network efficiency
 * - Server syncs mapping table to clients at connection
 * - World storage uses string IDs (future-proof, no conflicts)
 * 
 * String ID format: "namespace:blockname"
 * - Official blocks: "vaste:stone", "vaste:dirt", etc.
 * - Mod blocks: "mymod:custom_block", "othermod:special_ore", etc.
 */

/**
 * Official block registry - string IDs only
 */
const BLOCK_REGISTRY = new Map([
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
 * BlockMappingManager - Server-side mapping manager
 * 
 * Handles runtime numeric ID assignment and client synchronization.
 * Numeric IDs are ONLY used for network efficiency (2 bytes vs variable-length strings).
 */
class BlockMappingManager {
  constructor() {
    this.stringToNumeric = new Map();
    this.numericToString = new Map();
    this.nextNumericId = 1; // 0 reserved for air

    // Pre-register official blocks
    this.registerBlock("vaste:air", 0); // Air always gets ID 0
    
    // Auto-register all official blocks with sequential IDs
    for (const [stringId, _] of BLOCK_REGISTRY) {
      if (stringId !== "vaste:air") {
        this.registerBlock(stringId);
      }
    }

    console.log(`[BlockRegistry] Initialized with ${BLOCK_REGISTRY.size} official blocks`);
    console.log('[BlockRegistry] Mapping table:', this.exportMappingTable());
  }

  /**
   * Register a block and assign it a numeric ID
   * @param {string} stringId String ID (e.g., "vaste:stone", "mymod:ruby")
   * @param {number} [forcedNumericId] Optional: force a specific numeric ID (for world loading)
   * @returns {number} The assigned numeric ID
   */
  registerBlock(stringId, forcedNumericId) {
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
  getNumericId(stringId) {
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
  getStringId(numericId) {
    const stringId = this.numericToString.get(numericId);
    if (stringId === undefined) {
      console.warn(`[BlockMapping] Unknown numeric ID: ${numericId}, returning vaste:air`);
      return "vaste:air"; // Fallback to air
    }
    return stringId;
  }

  /**
   * Export current mapping table (for client sync)
   */
  exportMappingTable() {
    return Array.from(this.stringToNumeric.entries()).map(([stringId, numericId]) => ({
      stringId,
      numericId,
    }));
  }

  /**
   * Get all registered string IDs
   */
  getAllStringIds() {
    return Array.from(this.stringToNumeric.keys());
  }
}

// Global mapping manager instance
const blockMapping = new BlockMappingManager();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get block definition by string ID
 */
function getBlockDefinition(stringId) {
  return BLOCK_REGISTRY.get(stringId);
}

/**
 * Get block internal name from string ID
 */
function getBlockName(stringIdOrNumeric) {
  const stringId = typeof stringIdOrNumeric === 'number' 
    ? blockMapping.getStringId(stringIdOrNumeric)
    : stringIdOrNumeric;
    
  const block = BLOCK_REGISTRY.get(stringId);
  return block?.name || "air";
}

/**
 * Check if block is solid
 */
function isBlockSolid(stringIdOrNumeric) {
  const stringId = typeof stringIdOrNumeric === 'number'
    ? blockMapping.getStringId(stringIdOrNumeric)
    : stringIdOrNumeric;
    
  const block = BLOCK_REGISTRY.get(stringId);
  return block?.solid || false;
}

/**
 * Register a new block (for mods)
 */
function registerBlock(definition) {
  BLOCK_REGISTRY.set(definition.stringId, definition);
  return blockMapping.registerBlock(definition.stringId);
}

module.exports = {
  BLOCK_REGISTRY,
  blockMapping,
  getBlockDefinition,
  getBlockName,
  isBlockSolid,
  registerBlock,
};
