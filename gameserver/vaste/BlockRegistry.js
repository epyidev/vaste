const fs = require('fs');
const path = require('path');
const { log, warn, error } = require('./Logger');

/**
 * BlockRegistry - Server-side String-Based Block System
 * 
 * DEVELOPER-FACING: Use string IDs only!
 * - To add a block: just create a folder in blockpacks/ with a block.json file
 * - NO manual numeric IDs needed
 * 
 * INTERNAL SYSTEM (automatic):
 * - Blocks are loaded dynamically from blockpacks/ directory
 * - Each folder = 1 block (folder name doesn't matter, stringId in block.json does)
 * - Numeric IDs are generated at runtime for network efficiency
 * - Server syncs mapping table to clients at connection
 * - World storage uses string IDs (future-proof, no conflicts)
 * 
 * String ID format: "namespace:blockname"
 * - Official blocks: "vaste:stone", "vaste:dirt", etc.
 * - Mod blocks: "mymod:custom_block", "othermod:special_ore", etc.
 */

/**
 * Load all blocks from blockpacks directory
 */
function loadBlockpacks() {
  const BLOCK_REGISTRY = new Map();
  const blockpacksPath = path.join(__dirname, 'blockpacks');
  
  // Always add air block first (hardcoded special case)
  BLOCK_REGISTRY.set("vaste:air", {
    stringId: "vaste:air",
    name: "air",
    displayName: "Air",
    solid: false,
    transparent: true,
  });

  try {
    // Read all directories in blockpacks folder
    const entries = fs.readdirSync(blockpacksPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip files, only process directories
      if (!entry.isDirectory()) {
        continue;
      }

      const blockDir = path.join(blockpacksPath, entry.name);
      const blockJsonPath = path.join(blockDir, 'block.json');

      // Check if block.json exists
      if (fs.existsSync(blockJsonPath)) {
        try {
          const blockData = JSON.parse(fs.readFileSync(blockJsonPath, 'utf8'));
          
          // Validate required fields
          if (!blockData.stringId) {
            warn(`Block in ${entry.name}/ missing stringId, skipping`);
            continue;
          }

          // Add to registry
          BLOCK_REGISTRY.set(blockData.stringId, {
            stringId: blockData.stringId,
            name: blockData.name || entry.name,
            displayName: blockData.displayName || blockData.name || entry.name,
            solid: blockData.solid !== undefined ? blockData.solid : true,
            transparent: blockData.transparent !== undefined ? blockData.transparent : false,
            textures: blockData.textures || {},
            ...blockData // Include any additional properties
          });

        } catch (err) {
          error(`Error loading block from ${entry.name}/block.json: ${err.message}`);
        }
      } else {
        warn(`Directory ${entry.name}/ has no block.json, skipping`);
      }
    }
  } catch (err) {
    error(`Error reading blockpacks directory: ${err.message}`);
  }

  return BLOCK_REGISTRY;
}

/**
 * Official block registry - dynamically loaded from blockpacks
 */
const BLOCK_REGISTRY = loadBlockpacks();

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

    log(`Initialized with ${BLOCK_REGISTRY.size} official blocks`);
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
      warn(`[BlockMapping] Unknown string ID: ${stringId}, returning 0 (air)`);
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
      warn(`[BlockMapping] Unknown numeric ID: ${numericId}, returning vaste:air`);
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
