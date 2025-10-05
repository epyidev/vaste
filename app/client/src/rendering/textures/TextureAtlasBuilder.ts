/**
 * Professional Texture Atlas Builder
 * Supports thousands of textures with different sizes
 * Uses bin-packing algorithm for optimal space utilization
 */

import * as THREE from 'three';
import { TextureRegistry, TextureEntry } from './TextureRegistry';
import { TextureLoader, LoadedImage } from './TextureLoader';

interface AtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
  texturePath: string;
}

interface AtlasNode {
  x: number;
  y: number;
  width: number;
  height: number;
  used: boolean;
  right?: AtlasNode;
  down?: AtlasNode;
}

export class TextureAtlasBuilder {
  private registry: TextureRegistry;
  private loader: TextureLoader;
  private atlasTexture: THREE.Texture | null = null;
  private atlasSize: number = 2048;
  private padding: number = 2; // 2 pixels of padding between tiles to prevent bleeding
  private rects: AtlasRect[] = [];

  constructor(registry: TextureRegistry, loader: TextureLoader, atlasSize: number = 2048) {
    this.registry = registry;
    this.loader = loader;
    this.atlasSize = atlasSize;
  }

  async build(): Promise<THREE.Texture> {
    console.log('[TextureAtlasBuilder] Starting build...');

    const textures = this.registry.getAllTextures();
    console.log(`[TextureAtlasBuilder] Found ${textures.length} textures to pack`);

    if (textures.length === 0) {
      console.warn('[TextureAtlasBuilder] No textures registered, creating fallback');
      return this.createFallbackAtlas();
    }

    const uniquePaths = [...new Set(textures.map(t => t.path))];
    const loadedImages = await this.loader.loadBatch(uniquePaths);

    console.log(`[TextureAtlasBuilder] Loaded ${loadedImages.length} images`);

    // Update registry with real image sizes
    console.log('[TextureAtlasBuilder] Updating registry with real image sizes...');
    for (const img of loadedImages) {
      const texture = this.registry.getTexture(img.path);
      if (texture) {
        texture.width = img.width;
        texture.height = img.height;
        console.log(`  Updated: ${img.path} -> ${img.width}x${img.height}`);
      }
    }

    const sortedImages = loadedImages.sort((a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      return areaB - areaA;
    });

    const packed = this.packTextures(sortedImages);

    if (!packed) {
      console.error('[TextureAtlasBuilder] Failed to pack textures, atlas too small');
      return this.createFallbackAtlas();
    }

    const atlas = this.renderAtlas(sortedImages);

    this.updateRegistry();

    console.log(`[TextureAtlasBuilder] Atlas created: ${this.atlasSize}x${this.atlasSize}, ${this.rects.length} textures`);

    return atlas;
  }

  private packTextures(images: LoadedImage[]): boolean {
    this.rects = [];
    const root: AtlasNode = {
      x: 0,
      y: 0,
      width: this.atlasSize,
      height: this.atlasSize,
      used: false,
    };

    for (const img of images) {
      const w = img.width + this.padding * 2;
      const h = img.height + this.padding * 2;
      
      const node = this.findNode(root, w, h);
      
      if (!node) {
        console.error(`[TextureAtlasBuilder] Could not fit texture: ${img.path} (${img.width}x${img.height})`);
        return false;
      }

      const split = this.splitNode(node, w, h);
      
      this.rects.push({
        x: split.x + this.padding,
        y: split.y + this.padding,
        width: img.width,
        height: img.height,
        texturePath: img.path,
      });
    }

    return true;
  }

  private findNode(node: AtlasNode, w: number, h: number): AtlasNode | null {
    if (node.used) {
      return this.findNode(node.right!, w, h) || this.findNode(node.down!, w, h);
    } else if (w <= node.width && h <= node.height) {
      return node;
    } else {
      return null;
    }
  }

  private splitNode(node: AtlasNode, w: number, h: number): AtlasNode {
    node.used = true;
    node.down = {
      x: node.x,
      y: node.y + h,
      width: node.width,
      height: node.height - h,
      used: false,
    };
    node.right = {
      x: node.x + w,
      y: node.y,
      width: node.width - w,
      height: h,
      used: false,
    };
    return node;
  }

  private renderAtlas(images: LoadedImage[]): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = this.atlasSize;
    canvas.height = this.atlasSize;
    const ctx = canvas.getContext('2d')!;

    // Transparent background instead of magenta
    ctx.clearRect(0, 0, this.atlasSize, this.atlasSize);

    console.log(`[TextureAtlasBuilder] Rendering ${images.length} images to atlas`);

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const rect = this.rects[i];

      if (rect) {
        // If image is the fallback (magenta checkerboard), draw it
        // Otherwise draw the real texture
        if (img.path === 'missing' || img.path.includes('fallback')) {
          // Draw magenta checkerboard fallback
          ctx.fillStyle = '#FF00FF';
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
          ctx.fillStyle = '#000000';
          const halfW = rect.width / 2;
          const halfH = rect.height / 2;
          ctx.fillRect(rect.x, rect.y, halfW, halfH);
          ctx.fillRect(rect.x + halfW, rect.y + halfH, halfW, halfH);
          console.log(`[TextureAtlasBuilder] Drew FALLBACK for ${img.path} at (${rect.x}, ${rect.y})`);
        } else {
          // Draw the main texture
          ctx.drawImage(img.image, rect.x, rect.y, rect.width, rect.height);
          
          // Edge padding: extend edge pixels into padding area to prevent bleeding
          // This is critical for preventing dark edges on distant blocks
          if (this.padding > 0) {
            // Top edge padding
            ctx.drawImage(img.image, 
              0, 0, img.width, 1,  // Source: top row
              rect.x, rect.y - this.padding, rect.width, this.padding  // Dest: above texture
            );
            
            // Bottom edge padding
            ctx.drawImage(img.image,
              0, img.height - 1, img.width, 1,  // Source: bottom row
              rect.x, rect.y + rect.height, rect.width, this.padding  // Dest: below texture
            );
            
            // Left edge padding
            ctx.drawImage(img.image,
              0, 0, 1, img.height,  // Source: left column
              rect.x - this.padding, rect.y, this.padding, rect.height  // Dest: left of texture
            );
            
            // Right edge padding
            ctx.drawImage(img.image,
              img.width - 1, 0, 1, img.height,  // Source: right column
              rect.x + rect.width, rect.y, this.padding, rect.height  // Dest: right of texture
            );
            
            // Corner padding (fill with corner pixels)
            // Top-left
            ctx.fillStyle = this.getPixelColor(img.image, 0, 0);
            ctx.fillRect(rect.x - this.padding, rect.y - this.padding, this.padding, this.padding);
            
            // Top-right
            ctx.fillStyle = this.getPixelColor(img.image, img.width - 1, 0);
            ctx.fillRect(rect.x + rect.width, rect.y - this.padding, this.padding, this.padding);
            
            // Bottom-left
            ctx.fillStyle = this.getPixelColor(img.image, 0, img.height - 1);
            ctx.fillRect(rect.x - this.padding, rect.y + rect.height, this.padding, this.padding);
            
            // Bottom-right
            ctx.fillStyle = this.getPixelColor(img.image, img.width - 1, img.height - 1);
            ctx.fillRect(rect.x + rect.width, rect.y + rect.height, this.padding, this.padding);
          }
          
          console.log(`[TextureAtlasBuilder] Drawing ${img.path} at (${rect.x}, ${rect.y}) size ${rect.width}x${rect.height} with edge padding`);
        }
      }
    }

    console.log('[TextureAtlasBuilder] Atlas canvas ready, creating texture');

    // Debug: save atlas to see what was generated
    if (typeof window !== 'undefined') {
      (window as any).__VASTE_ATLAS_URL__ = canvas.toDataURL();
      (window as any).__VASTE_DOWNLOAD_ATLAS__ = () => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL();
        a.download = 'vaste-texture-atlas.png';
        a.click();
      };
      console.log('[TextureAtlasBuilder] Debug: Run window.__VASTE_DOWNLOAD_ATLAS__() to download atlas');
      console.log('[TextureAtlasBuilder] Debug: Or check window.__VASTE_ATLAS_URL__ in console');
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    this.atlasTexture = texture;

    return texture;
  }

  /**
   * Get the color of a pixel from an image for edge padding
   */
  private getPixelColor(image: HTMLImageElement, x: number, y: number): string {
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = image.width;
      tempCanvas.height = image.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(image, 0, 0);
      
      const pixel = tempCtx.getImageData(x, y, 1, 1).data;
      return `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;
    } catch (e) {
      // If we can't read the pixel (CORS issue), return a neutral color
      return '#808080';
    }
  }

  private updateRegistry(): void {
    console.log('[TextureAtlasBuilder] Updating registry with atlas positions...');
    for (let i = 0; i < this.rects.length; i++) {
      const rect = this.rects[i];
      this.registry.updateTextureAtlasPosition(rect.texturePath, 0, rect.x, rect.y);
      console.log(`  ${rect.texturePath}: pos=(${rect.x}, ${rect.y}), size=${rect.width}x${rect.height}`);
    }
  }

  private createFallbackAtlas(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillRect(8, 8, 8, 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    this.atlasTexture = texture;
    return texture;
  }

  getUVs(texturePath: string): [number, number, number, number] {
    const texture = this.registry.getTexture(texturePath);
    if (!texture || texture.atlasX === undefined || texture.atlasY === undefined) {
      console.warn(`[TextureAtlasBuilder] Texture not found or not positioned: ${texturePath}`);
      return [0, 0, 1, 1];
    }

    // Add a larger inset to prevent texture bleeding between atlas tiles
    // This is especially important for distant blocks where precision decreases
    // 1.0 pixel inset is recommended for voxel textures with atlases
    const inset = 1.0; // One full pixel inset in texture space
    
    // No V-flip needed - we'll handle orientation in vertex order
    const u0 = (texture.atlasX + inset) / this.atlasSize;
    const v0 = (texture.atlasY + inset) / this.atlasSize;
    const u1 = (texture.atlasX + texture.width - inset) / this.atlasSize;
    const v1 = (texture.atlasY + texture.height - inset) / this.atlasSize;

    if (!this.hasLoggedUVCalc) {
      console.log(`[TextureAtlasBuilder] UV calc for ${texturePath}:`);
      console.log(`  atlasPos=(${texture.atlasX}, ${texture.atlasY}), size=${texture.width}x${texture.height}, atlasSize=${this.atlasSize}`);
      console.log(`  UVs with ${inset}px inset: u0=${u0}, v0=${v0}, u1=${u1}, v1=${v1}`);
      this.hasLoggedUVCalc = true;
    }

    return [u0, v0, u1, v1];
  }

  private hasLoggedUVCalc = false;

  getTexture(): THREE.Texture | null {
    return this.atlasTexture;
  }
}
