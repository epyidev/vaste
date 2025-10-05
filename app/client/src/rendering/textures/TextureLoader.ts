/**
 * Texture Loader - Async texture loading with caching and fallback
 */

export interface LoadedImage {
  image: HTMLImageElement;
  width: number;
  height: number;
  path: string;
}

export class TextureLoader {
  private cache = new Map<string, LoadedImage>();
  private loading = new Map<string, Promise<LoadedImage>>();
  private fallbackImage: HTMLImageElement | null = null;

  async load(path: string): Promise<LoadedImage> {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    if (this.loading.has(path)) {
      return this.loading.get(path)!;
    }

    const promise = this.loadImage(path);
    this.loading.set(path, promise);

    try {
      const result = await promise;
      this.cache.set(path, result);
      this.loading.delete(path);
      return result;
    } catch (error) {
      this.loading.delete(path);
      console.error(`Failed to load texture: ${path}`, error);
      return this.getFallback(path);
    }
  }

  async loadBatch(paths: string[]): Promise<LoadedImage[]> {
    return Promise.all(paths.map(path => this.load(path)));
  }

  private loadImage(path: string): Promise<LoadedImage> {
    return new Promise((resolve, reject) => {
      if (path === 'missing') {
        resolve(this.getFallback(path));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log(`[TextureLoader] Loaded: ${path} (${img.width}x${img.height})`);
        resolve({
          image: img,
          width: img.width,
          height: img.height,
          path,
        });
      };

      img.onerror = () => {
        console.warn(`[TextureLoader] Failed: ${path}`);
        reject(new Error(`Failed to load: ${path}`));
      };

      img.src = path;
    });
  }

  private getFallback(path: string): LoadedImage {
    if (!this.fallbackImage) {
      this.fallbackImage = this.createFallbackImage();
    }

    return {
      image: this.fallbackImage,
      width: 16,
      height: 16,
      path: path || 'missing',
    };
  }

  private createFallbackImage(): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillRect(8, 8, 8, 8);

    const img = new Image();
    img.width = 16;
    img.height = 16;
    img.src = canvas.toDataURL();
    return img;
  }

  clear(): void {
    this.cache.clear();
    this.loading.clear();
  }
}

export const textureLoader = new TextureLoader();
