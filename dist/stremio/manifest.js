export class ManifestBuilder {
    static ADDON_ID = 'org.stremio.debridstream';
    static ADDON_VERSION = '1.0.0';
    static ADDON_NAME = 'DebridStream';
    /**
     * Builds unconfigured root manifest for /manifest.json
     */
    static buildUnconfigured() {
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
    static buildConfigured(config) {
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
