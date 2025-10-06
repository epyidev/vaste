/**
 * Content Security Policy Manager
 * Dynamically updates CSP to allow connections to game servers
 */

export class CSPManager {
  private static allowedOrigins = new Set<string>();

  /**
   * Add a server origin to the CSP whitelist
   * @param wsUrl WebSocket URL (e.g., ws://localhost:25565)
   * @param httpUrl HTTP URL for resources (e.g., http://localhost:25566)
   */
  static allowServer(wsUrl: string, httpUrl: string): void {
    try {
      // Parse WebSocket URL
      const wsOrigin = new URL(wsUrl);
      const wsScheme = wsOrigin.protocol === 'wss:' ? 'wss:' : 'ws:';
      const wsHost = `${wsScheme}//${wsOrigin.host}`;

      // Parse HTTP URL
      const httpOrigin = new URL(httpUrl);
      const httpScheme = httpOrigin.protocol === 'https:' ? 'https:' : 'http:';
      const httpHost = `${httpScheme}//${httpOrigin.host}`;

      // Add to whitelist
      this.allowedOrigins.add(wsHost);
      this.allowedOrigins.add(httpHost);

      // Update CSP
      this.updateCSP();

      console.log(`[CSP] Allowed server: ${wsHost} and ${httpHost}`);
    } catch (error) {
      console.error('[CSP] Failed to parse server URLs:', error);
    }
  }

  /**
   * Update the Content Security Policy meta tag
   */
  private static updateCSP(): void {
    const cspMeta = document.getElementById('csp-meta') as HTMLMetaElement;
    if (!cspMeta) {
      console.warn('[CSP] CSP meta tag not found');
      return;
    }

    // Build dynamic CSP
    const origins = Array.from(this.allowedOrigins);
    
    // WebSocket origins (ws:// and wss://)
    const wsOrigins = origins.filter(o => o.startsWith('ws://') || o.startsWith('wss://'));
    
    // HTTP origins (http:// and https://)
    const httpOrigins = origins.filter(o => o.startsWith('http://') || o.startsWith('https://'));

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${httpOrigins.join(' ')}`,
      `connect-src 'self' ${wsOrigins.join(' ')} ${httpOrigins.join(' ')}`,
      "font-src 'self' data:",
      "worker-src 'self' blob:"
    ].join('; ');

    cspMeta.setAttribute('content', csp);

    console.log('[CSP] Updated policy:', csp);
  }

  /**
   * Reset CSP to default (remove all allowed servers)
   */
  static reset(): void {
    this.allowedOrigins.clear();
    this.updateCSP();
    console.log('[CSP] Reset to default policy');
  }
}
