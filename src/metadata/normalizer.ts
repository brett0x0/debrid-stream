import { MediaMetadata } from './types.js';

export class MetadataNormalizer {
  /**
   * Normalizes a title by stripping accents, symbols, extra whitespace,
   * and standardizing punctuation.
   */
  public static cleanTitle(title: string): string {
    if (!title) return '';

    return title
      .normalize('NFKD') // Split accents
      .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
      .replace(/['’`]/g, '') // Remove apostrophes (e.g. Don't -> Dont)
      .replace(/&/g, ' and ') // Replace & with 'and'
      .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with space
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Builds standardized search queries for torrent indexers.
   */
  public static buildSearchQueries(meta: MediaMetadata): string[] {
    const clean = this.cleanTitle(meta.title);
    const queries: string[] = [];

    if (meta.type === 'movie') {
      if (meta.year) {
        queries.push(`${clean} ${meta.year}`);
      }
      queries.push(clean);
    } else if (meta.type === 'series' && meta.season !== undefined && meta.episode !== undefined) {
      const s = String(meta.season).padStart(2, '0');
      const e = String(meta.episode).padStart(2, '0');

      // Standard S01E02
      queries.push(`${clean} S${s}E${e}`);
      // Alternative 1x02
      queries.push(`${clean} ${meta.season}x${e}`);
      // Season pack search fallback if needed
      queries.push(`${clean} S${s}`);
    }

    return Array.from(new Set(queries));
  }

  /**
   * Determines if a candidate torrent matches the requested media target.
   */
  public static isMatch(candidateTitle: string, meta: MediaMetadata): boolean {
    const normCand = this.cleanTitle(candidateTitle).toLowerCase();
    const normTarget = this.cleanTitle(meta.title).toLowerCase();

    // Check if candidate contains the full target title phrase with word boundaries
    const escapedTarget = normTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phraseRegex = new RegExp(`(^|\\b)${escapedTarget}(\\b|$)`, 'i');
    if (!phraseRegex.test(normCand)) {
      return false;
    }

    if (meta.type === 'movie' && meta.year) {
      // If candidate has a 4-digit year, it should match within +/- 1 year
      const yearMatch = candidateTitle.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
      if (yearMatch && yearMatch[1]) {
        const candYear = parseInt(yearMatch[1], 10);
        if (Math.abs(candYear - meta.year) > 1) {
          return false;
        }
      }
    }

    if (meta.type === 'series' && meta.season !== undefined && meta.episode !== undefined) {
      const s = meta.season;
      const e = meta.episode;

      // 1. Direct episode match (e.g. S01E02, 1x02)
      const sxe = new RegExp(`\\b[sS]0?${s}[eE]0?${e}\\b`, 'i');
      const alt = new RegExp(`\\b0?${s}x0?${e}\\b`, 'i');
      if (sxe.test(candidateTitle) || alt.test(candidateTitle)) {
        return true;
      }

      // 2. Season pack match (e.g. "American.Horror.Story.S03.1080p...", "Show Season 3")
      // Must contain S03 / Season 3, and NOT contain a different episode number (like E01, E02, E04)
      const seasonPattern = new RegExp(`\\b(?:[sS]0?${s}|Season\\s*0?${s})\\b`, 'i');
      const anyEpisodePattern = /\b(?:[sS]\d+[eE](\d+)|\d+x(\d+)|[eE][pP]?\s*(\d+))\b/i;

      if (seasonPattern.test(candidateTitle)) {
        const epMatch = candidateTitle.match(anyEpisodePattern);
        if (!epMatch) {
          // Pure season pack without specific episode in title -> matches all episodes in season
          return true;
        }
        const candEp = parseInt(epMatch[1] || epMatch[2] || epMatch[3] || '0', 10);
        if (candEp === e) {
          return true;
        }
      }

      return false;
    }

    return true;
  }
}
