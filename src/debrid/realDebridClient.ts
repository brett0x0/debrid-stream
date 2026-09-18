import {
  RdUser,
  RdInstantAvailabilityResponse,
  RdAddMagnetResponse,
  RdTorrentInfo,
  RdUnrestrictResponse,
} from './types.js';
import { maskToken } from '../config/userConfig.js';
import { env } from '../config/env.js';

export class RealDebridError extends Error {
  public statusCode?: number;
  public errorCode?: number;

  constructor(message: string, statusCode?: number, errorCode?: number) {
    super(message);
    this.name = 'RealDebridError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class RealDebridClient {
  private readonly baseUrl = 'https://api.real-debrid.com/rest/1.0';
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = env.RD_REQUEST_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Internal request helper with retry on 429 and token redaction.
   */
  private async request<T>(
    endpoint: string,
    token: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE';
      body?: Record<string, string> | URLSearchParams;
      retries?: number;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, retries = 2 } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let bodyData: string | undefined;
    if (body) {
      if (body instanceof URLSearchParams) {
        bodyData = body.toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(body)) {
          params.append(k, v);
        }
        bodyData = params.toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    let attempt = 0;
    while (attempt <= retries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          method,
          headers,
          body: bodyData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status === 429) {
          if (attempt <= retries) {
            // Exponential backoff with jitter
            const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 500;
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw new RealDebridError('Real-Debrid rate limit exceeded (429)', 429, 33);
        }

        if (res.status === 401 || res.status === 403) {
          throw new RealDebridError('Invalid or expired Real-Debrid API token', res.status);
        }

        if (!res.ok) {
          let errText = '';
          try {
            const errJson = (await res.json()) as any;
            errText = errJson?.error || JSON.stringify(errJson);
          } catch {
            errText = res.statusText;
          }
          throw new RealDebridError(`Real-Debrid API error (${res.status}): ${errText}`, res.status);
        }

        // Handle 204 No Content
        if (res.status === 204) {
          return {} as T;
        }

        return (await res.json()) as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err instanceof RealDebridError) {
          throw err;
        }
        if (err.name === 'AbortError') {
          throw new RealDebridError(`Real-Debrid request timed out after ${this.timeoutMs}ms`, 408);
        }
        if (attempt <= retries) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        // Sanitize any token from error message
        const safeMsg = (err.message || 'Unknown network error').replace(token, maskToken(token));
        throw new RealDebridError(safeMsg);
      }
    }

    throw new RealDebridError('Real-Debrid request failed after max retries');
  }

  /**
   * Validates user API token and returns user details.
   */
  public async getUser(token: string): Promise<RdUser> {
    return this.request<RdUser>('/user', token);
  }

  /**
   * Checks instant availability for up to 200 hashes in a single call.
   */
  public async getInstantAvailability(hashes: string[], token: string): Promise<RdInstantAvailabilityResponse> {
    if (hashes.length === 0) return {};

    // Max 200 hashes per request chunk as per RD API specs
    const cleanHashes = hashes.map((h) => h.toLowerCase().trim()).filter((h) => h.length === 40);
    if (cleanHashes.length === 0) return {};

    const chunks: string[][] = [];
    for (let i = 0; i < cleanHashes.length; i += 200) {
      chunks.push(cleanHashes.slice(i, i + 200));
    }

    const merged: RdInstantAvailabilityResponse = {};

    for (const chunk of chunks) {
      const hashPath = chunk.join('/');
      try {
        const resp = await this.request<RdInstantAvailabilityResponse>(`/torrents/instantAvailability/${hashPath}`, token);
        if (resp && typeof resp === 'object') {
          Object.assign(merged, resp);
        }
      } catch {
        // Return whatever availability was retrieved
      }
    }

    return merged;
  }

  /**
   * Adds a magnet link to Real-Debrid.
   */
  public async addMagnet(magnet: string, token: string): Promise<RdAddMagnetResponse> {
    return this.request<RdAddMagnetResponse>('/torrents/addMagnet', token, {
      method: 'POST',
      body: { magnet },
    });
  }

  /**
   * Selects files in a torrent (e.g. "all" or "1,2").
   */
  public async selectFiles(torrentId: string, fileIds: string, token: string): Promise<void> {
    await this.request<void>(`/torrents/selectFiles/${torrentId}`, token, {
      method: 'POST',
      body: { files: fileIds },
    });
  }

  /**
   * Fetches full torrent status and file list.
   */
  public async getTorrentInfo(torrentId: string, token: string): Promise<RdTorrentInfo> {
    return this.request<RdTorrentInfo>(`/torrents/info/${torrentId}`, token);
  }

  /**
   * Converts a hoster/torrent file link into an unrestricted streaming URL.
   */
  public async unrestrictLink(link: string, token: string): Promise<RdUnrestrictResponse> {
    return this.request<RdUnrestrictResponse>('/unrestrict/link', token, {
      method: 'POST',
      body: { link },
    });
  }

  /**
   * High-level helper: Given a torrent magnet / hash, resolves the playable streaming link.
   * If the torrent is already cached on RD, selects files and immediately un-restricts the target file.
   */
  public async resolvePlayableStream(
    magnetUri: string,
    token: string,
    fileIdx?: number
  ): Promise<RdUnrestrictResponse> {
    // 1. Add magnet
    const added = await this.addMagnet(magnetUri, token);

    // 2. Select files
    const fileSelection = fileIdx !== undefined ? String(fileIdx) : 'all';
    await this.selectFiles(added.id, fileSelection, token);

    // 3. Get torrent info to obtain links
    const info = await this.getTorrentInfo(added.id, token);

    if (!info.links || info.links.length === 0) {
      throw new RealDebridError('No links generated for this torrent on Real-Debrid', 404);
    }

    // Pick target link (or first link)
    const targetLink = info.links[0]!;

    // 4. Unrestrict link
    return this.unrestrictLink(targetLink, token);
  }
}
