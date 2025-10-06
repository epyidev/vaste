/**
 * index.js - World system entry point
 * Exports all world system components and registers default generators
 */

const { Chunk, CHUNK_SIZE, VOXELS_PER_CHUNK } = require('./Chunk');
const { Region, REGION_SIZE, CHUNKS_PER_REGION } = require('./Region');
const { World } = require('./World');
const { WorldStorage } = require('./WorldStorage');
const { GeneratorRegistry, registry } = require('./GeneratorRegistry');
const { FlatworldGenerator } = require('./generators/FlatworldGenerator');

// Register default generators
registry.register('flatworld', FlatworldGenerator);

console.log('[WorldSystem] Initialized world system');
console.log('[WorldSystem] Registered generators:', registry.getNames().join(', '));

module.exports = {
    // Core classes
    Chunk,
    Region,
    World,
    WorldStorage,
    GeneratorRegistry,
    
    // Constants
    CHUNK_SIZE,
    VOXELS_PER_CHUNK,
    REGION_SIZE,
    CHUNKS_PER_REGION,
    
    // Global registry
    registry,
    
    // Generators
    generators: {
        FlatworldGenerator
    }
};
