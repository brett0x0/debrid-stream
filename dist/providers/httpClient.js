export const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
export async function safeFetch(url, options = {}) {
    const headers = {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'application/json, application/xml, text/xml, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(options.headers || {}),
    };
    const signal = options.signal || AbortSignal.timeout(2500);
    return fetch(url, {
        ...options,
        headers,
        signal,
    });
}
