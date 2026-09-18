import { StremioManifest } from './types.js';
import { UserConfig } from '../config/userConfig.js';

export class ManifestBuilder {
  public static readonly ADDON_ID = 'org.stremio.debridstream';
  public static readonly ADDON_VERSION = '1.0.0';
  public static readonly ADDON_NAME = 'DebridStream';

  /**
   * Builds unconfigured root manifest for /manifest.json
   */
  public static buildUnconfigured(): StremioManifest {
    return {
      id: this.ADDON_ID,
      version: this.ADDON_VERSION,
      name: this.ADDON_NAME,
      description: 'Production-grade self-hosted Real-Debrid streaming addon for Stremio.',
      resources: ['stream'],
      types: ['movie', 'series'],
      idPrefixes: ['tt'],
      catalogs: [],
      behaviorHints: {
        configurable: true,
        configurationRequired: true,
      },
    };
  }

  /**
   * Builds configured manifest for /:config/manifest.json
   */
  public static buildConfigured(config: UserConfig): StremioManifest {
    const resSummary = config.preferredResolutions.join(', ');

    return {
      id: this.ADDON_ID,
      version: this.ADDON_VERSION,
      name: `${this.ADDON_NAME} [RD]`,
      description: `Real-Debrid streams (${resSummary})`,
      resources: ['stream'],
      types: ['movie', 'series'],
      idPrefixes: ['tt'],
      catalogs: [],
      behaviorHints: {
        configurable: true,
        configurationRequired: false,
      },
    };
  }
}
