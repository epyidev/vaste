/**
 * Block Registry - String-Based Block System with Server-Side Loading
 * 
 * DEVELOPER-FACING: Blockpacks are managed server-side!
 * - Each server can have its own blockpacks
 * - Client downloads blockpacks from server on connection
 * - Blocks are loaded dynamically from server data
 * 
 * Block definitions received from server include:
 * {
 *   "stringId": "namespace:name",     // e.g., "vaste:stone", "mymod:ruby"
 *   "name": "stone",                   // Internal name
 *   "displayName": "Stone",            // Human-readable name
 *   "solid": true,                     // Is solid (blocks movement)
 *   "transparent": false,              // Is transparent (affects rendering)
 *   "textures": { ... }                // Texture definitions
 * }
 * 
 * INTERNAL SYSTEM (automatic):
 * - Receives blockpack data from gameserver via WebSocket
 * - Loads textures from gameserver HTTP endpoint
 * - Numeric IDs are generated at runtime for network efficiency
 * - Client/server sync mapping table at connection
 */

export interface BlockDefinition {
  stringId: string;        // e.g., "vaste:stone", "mymod:ruby"
  name: string;            // Internal name (e.g., "stone", "dirt")
  displayName: string;     // Human-readable name
  solid: boolean;
  transparent: boolean;
  friction?: number;       // Friction coefficient (0-1, higher = more slippery)
  textures?: any;          // Texture configuration (loaded from block.json)
}

/**
 * Dynamic block registry - Populated from server blockpacks
 */
let BLOCK_REGISTRY = new Map<string, BlockDefinition>();
let serverUrl: string = ''; // Will be set when loading from server

/**
 * Load blocks from server-provided blockpack data
 * @param blockpacksData Array of block definitions from server
 * @param gameServerUrl URL of the game server (for texture loading)
 */
export async function loadBlockpacksFromServer(
  blockpacksData: any[],
  gameServerUrl: string
): Promise<void> {
  console.log('Loading blockpacks from server...');
  console.log(`Server URL: ${gameServerUrl}`);
  
  // Store server URL for texture loading
  serverUrl = gameServerUrl;
  
  // Clear existing registry
  BLOCK_REGISTRY.clear();
  
  // Always register air first (hardcoded special block)
  BLOCK_REGISTRY.set("vaste:air", {
    stringId: "vaste:air",
    name: "air",
    displayName: "Air",
    solid: false,
    transparent: true,
  });

  let loadedCount = 0;

  for (const blockData of blockpacksData) {
    try {
      // Validate required fields
      if (!blockData.stringId || !blockData.name || !blockData.displayName) {
        console.error(`Invalid block data:`, blockData);
        continue;
      }

      // Update texture paths to point to server
      const textures = blockData.textures || {};
      const updatedTextures: any = {};
      
      for (const [key, value] of Object.entries(textures)) {
        if (typeof value === 'string') {
          // Replace /blockpacks/ with server URL
          updatedTextures[key] = value.replace('/blockpacks/', `${serverUrl}/blockpacks/`);
        }
      }

      // Create block definition
      const definition: BlockDefinition = {
        stringId: blockData.stringId,
        name: blockData.name,
        displayName: blockData.displayName,
        solid: blockData.solid !== undefined ? blockData.solid : true,
        transparent: blockData.transparent !== undefined ? blockData.transparent : false,
        friction: blockData.friction !== undefined ? blockData.friction : 0.6,
        textures: updatedTextures,
      };

      BLOCK_REGISTRY.set(definition.stringId, definition);
      loadedCount++;

      console.log(`✓ Loaded ${definition.stringId} (${definition.displayName})`);
    } catch (error) {
      console.error(`Error loading block:`, error);
    }
  }

  console.log(`Successfully loaded ${loadedCount}/${blockpacksData.length} blockpacks from server`);
}

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
    // Air will be registered when blockpacks load from server
  }

  /**
   * Initialize mapping manager after blocks are loaded
   */
  initializeFromRegistry(): void {
    // Register air first (ID 0)
    this.registerBlock("vaste:air", 0);
    
    // Auto-register all loaded blocks with sequential IDs
    for (const [stringId, _] of BLOCK_REGISTRY) {
      if (stringId !== "vaste:air") {
        this.registerBlock(stringId);
      }
    }
    
    console.log(`[BlockMapping] Initialized with ${this.stringToNumeric.size} blocks`);
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
 * Get friction coefficient of a block
 * Returns a value between 0 and 1, where higher values mean more slippery
 * Default is 0.6 for most blocks
 */
export function getBlockFriction(stringIdOrNumeric: string | number): number {
  const stringId = typeof stringIdOrNumeric === 'number'
    ? blockMapping.getStringId(stringIdOrNumeric)
    : stringIdOrNumeric;
    
  const block = BLOCK_REGISTRY.get(stringId);
  return block?.friction !== undefined ? block.friction : 0.6;
}

/**
 * Get all block definitions
 */
export function getAllBlocks(): BlockDefinition[] {
  return Array.from(BLOCK_REGISTRY.values());
}

/**
 * Register a new block (for mods or dynamic loading)
 */
export function registerBlock(definition: BlockDefinition): number {
  BLOCK_REGISTRY.set(definition.stringId, definition);
  return blockMapping.registerBlock(definition.stringId);
}

/**
 * Get the block registry (useful for debugging)
 */
export function getBlockRegistry(): Map<string, BlockDefinition> {
  return BLOCK_REGISTRY;
}
