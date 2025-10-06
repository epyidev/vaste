/**
 * GeneratorRegistry.js - Extensible world generator system
 * Allows registering multiple generator types
 */

const { log, warn } = require('../Logger');

class GeneratorRegistry {
    constructor() {
        this.generators = new Map();
    }

    /**
     * Register a new generator
     * @param {string} name - Generator name (e.g., "flatworld", "perlin", "void")
     * @param {Function} generatorClass - Generator class constructor
     */
    register(name, generatorClass) {
        this.generators.set(name, generatorClass);
        log(`Registered generator: ${name}`);
    }

    /**
     * Get a generator class by name
     * @param {string} name - Generator name
     * @returns {Function|null}
     */
    get(name) {
        return this.generators.get(name) || null;
    }

    /**
     * Create a generator instance
     * @param {string} name - Generator name
     * @param {Object} options - Generator options
     * @returns {Object} Generator instance
     */
    create(name, options = {}) {
        const GeneratorClass = this.get(name);
        if (!GeneratorClass) {
            throw new Error(`Generator not found: ${name}`);
        }
        return new GeneratorClass(options);
    }

    /**
     * Get list of all registered generator names
     * @returns {string[]}
     */
    getNames() {
        return Array.from(this.generators.keys());
    }

    /**
     * Check if a generator is registered
     * @param {string} name - Generator name
     * @returns {boolean}
     */
    has(name) {
        return this.generators.has(name);
    }
}

// Global singleton instance
const registry = new GeneratorRegistry();

module.exports = { GeneratorRegistry, registry };
