export class RssHelper {
    static parseItems(xml) {
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const itemContent = match[1];
            // Extract title
            const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
            const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : '';
            // Extract link
            const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
            const link = linkMatch && linkMatch[1] ? linkMatch[1].trim() : '';
            // Extract infoHash directly (e.g. Nyaa: <nyaa:infoHash>...</nyaa:infoHash>)
            let infoHash = '';
            const hashMatch = itemContent.match(/<(?:nyaa:)?infoHash>(?:<!\[CDATA\[)?([a-fA-F0-9]{40})(?:\]\]>)?<\/(?:nyaa:)?infoHash>/i);
            if (hashMatch && hashMatch[1]) {
                infoHash = hashMatch[1].toLowerCase();
            }
            // Check magnet in link or description
            let magnetUri;
            const magnetMatch = itemContent.match(/magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"<'\s]*/i);
            if (magnetMatch && magnetMatch[1]) {
                infoHash = infoHash || magnetMatch[1].toLowerCase();
                magnetUri = magnetMatch[0];
            }
            // Extract seeders
            let seeders = 0;
            const seedMatch = itemContent.match(/<(?:nyaa:)?seeders>([0-9]+)<\//i);
            if (seedMatch && seedMatch[1]) {
                seeders = parseInt(seedMatch[1], 10);
            }
            // Extract leechers
            let leechers = 0;
            const leechMatch = itemContent.match(/<(?:nyaa:)?leechers>([0-9]+)<\//i);
            if (leechMatch && leechMatch[1]) {
                leechers = parseInt(leechMatch[1], 10);
            }
            // Extract size
            let sizeBytes = 0;
            const lengthMatch = itemContent.match(/length="([0-9]+)"/i);
            if (lengthMatch && lengthMatch[1]) {
                sizeBytes = parseInt(lengthMatch[1], 10);
            }
            if (title && infoHash) {
                items.push({
                    title,
                    link,
                    infoHash,
                    sizeBytes,
                    seeders,
                    leechers,
                    magnetUri,
                });
            }
        }
        return items;
    }
}
