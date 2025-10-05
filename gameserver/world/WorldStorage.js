/**
 * WorldStorage.js - Handles world persistence to disk
 * Stores world data in region files at mod/worldPath/regions/
 */

const fs = require('fs');
const path = require('path');
const { Region, REGION_SIZE } = require('./Region');

class WorldStorage {
    /**
     * Create a new world storage manager
     * @param {string} worldPath - Path to world directory (e.g., mod/savedworld/testworld)
     */
    constructor(worldPath) {
        this.worldPath = worldPath;
        this.regionsPath = path.join(worldPath, 'regions');
        
        // Ensure directories exist
        this._ensureDirectories();
    }

    /**
     * Ensure world directories exist
     * @private
     */
    _ensureDirectories() {
        try {
            if (!fs.existsSync(this.worldPath)) {
                fs.mkdirSync(this.worldPath, { recursive: true });
            }
            if (!fs.existsSync(this.regionsPath)) {
                fs.mkdirSync(this.regionsPath, { recursive: true });
            }
        } catch (error) {
            console.error(`[WorldStorage] Error creating directories: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get region file path
     * @param {number} rx - Region X
     * @param {number} ry - Region Y
     * @param {number} rz - Region Z
     * @returns {string}
     * @private
     */
    _getRegionFilePath(rx, ry, rz) {
        return path.join(this.regionsPath, `r.${rx}.${ry}.${rz}.dat`);
    }

    /**
     * Check if a region file exists
     * @param {number} rx - Region X
     * @param {number} ry - Region Y
     * @param {number} rz - Region Z
     * @returns {boolean}
     */
    hasRegion(rx, ry, rz) {
        const filePath = this._getRegionFilePath(rx, ry, rz);
        return fs.existsSync(filePath);
    }

    /**
     * Load a region from disk
     * @param {number} rx - Region X
     * @param {number} ry - Region Y
     * @param {number} rz - Region Z
     * @returns {Region|null}
     */
    loadRegion(rx, ry, rz) {
        const filePath = this._getRegionFilePath(rx, ry, rz);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        try {
            const buffer = fs.readFileSync(filePath);
            const region = Region.deserialize(buffer, rx, ry, rz);
            console.log(`[WorldStorage] Loaded region (${rx}, ${ry}, ${rz}) with ${region.chunks.size} chunks`);
            return region;
        } catch (error) {
            console.error(`[WorldStorage] Error loading region (${rx}, ${ry}, ${rz}): ${error.message}`);
            return null;
        }
    }

    /**
     * Save a region to disk
     * @param {Region} region - Region to save
     * @returns {boolean} Success
     */
    saveRegion(region) {
        // Don't save empty regions
        if (region.isEmpty()) {
            // Delete file if it exists
            const filePath = this._getRegionFilePath(region.rx, region.ry, region.rz);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[WorldStorage] Deleted empty region file (${region.rx}, ${region.ry}, ${region.rz})`);
                } catch (error) {
                    console.error(`[WorldStorage] Error deleting region file: ${error.message}`);
                }
            }
            return true;
        }
        
        const filePath = this._getRegionFilePath(region.rx, region.ry, region.rz);
        
        try {
            const buffer = region.serialize();
            fs.writeFileSync(filePath, buffer);
            region.dirty = false;
            console.log(`[WorldStorage] Saved region (${region.rx}, ${region.ry}, ${region.rz}) with ${region.chunks.size} chunks`);
            return true;
        } catch (error) {
            console.error(`[WorldStorage] Error saving region (${region.rx}, ${region.ry}, ${region.rz}): ${error.message}`);
            return false;
        }
    }

    /**
     * Save world metadata
     * @param {Object} metadata - World metadata
     */
    saveMetadata(metadata) {
        const metadataPath = path.join(this.worldPath, 'world.json');
        
        try {
            // Add block mapping table to metadata
            const { blockMapping } = require('../BlockRegistry');
            const enrichedMetadata = {
                ...metadata,
                blockMappings: blockMapping.exportMappingTable(), // Save string<->numeric mapping
                savedAt: new Date().toISOString()
            };
            
            fs.writeFileSync(metadataPath, JSON.stringify(enrichedMetadata, null, 2));
            console.log(`[WorldStorage] Saved world metadata with ${enrichedMetadata.blockMappings.length} block mappings`);
        } catch (error) {
            console.error(`[WorldStorage] Error saving metadata: ${error.message}`);
        }
    }

    /**
     * Load world metadata
     * @returns {Object|null}
     */
    loadMetadata() {
        const metadataPath = path.join(this.worldPath, 'world.json');
        
        if (!fs.existsSync(metadataPath)) {
            return null;
        }
        
        try {
            const data = fs.readFileSync(metadataPath, 'utf8');
            const metadata = JSON.parse(data);
            
            // Restore block mapping table if present
            if (metadata.blockMappings && Array.isArray(metadata.blockMappings)) {
                const { blockMapping } = require('../BlockRegistry');
                
                // Clear current mappings and reload from save file
                blockMapping.stringToNumeric.clear();
                blockMapping.numericToString.clear();
                blockMapping.nextNumericId = 1;
                
                // Re-register blocks with their saved numeric IDs
                for (const { stringId, numericId } of metadata.blockMappings) {
                    blockMapping.registerBlock(stringId, numericId);
                }
                
                console.log(`[WorldStorage] Restored ${metadata.blockMappings.length} block mappings from save file`);
            } else {
                console.log(`[WorldStorage] No block mappings in save file (old world format)`);
            }
            
            return metadata;
        } catch (error) {
            console.error(`[WorldStorage] Error loading metadata: ${error.message}`);
            return null;
        }
    }

    /**
     * Get list of all region files
     * @returns {Array<{rx: number, ry: number, rz: number}>}
     */
    listRegions() {
        const regions = [];
        
        try {
            if (!fs.existsSync(this.regionsPath)) {
                return regions;
            }
            
            const files = fs.readdirSync(this.regionsPath);
            const regionPattern = /^r\.(-?\d+)\.(-?\d+)\.(-?\d+)\.dat$/;
            
            for (const file of files) {
                const match = file.match(regionPattern);
                if (match) {
                    regions.push({
                        rx: parseInt(match[1]),
                        ry: parseInt(match[2]),
                        rz: parseInt(match[3])
                    });
                }
            }
        } catch (error) {
            console.error(`[WorldStorage] Error listing regions: ${error.message}`);
        }
        
        return regions;
    }
}

module.exports = { WorldStorage };
