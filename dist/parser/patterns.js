export const PATTERNS = {
    resolution: [
        { pattern: /\b(?:2160p|4k|uhd)\b/i, value: '2160p' },
        { pattern: /\b(?:1080p|1080i|fhd)\b/i, value: '1080p' },
        { pattern: /\b(?:720p|hd)\b/i, value: '720p' },
        { pattern: /\b(?:480p|576p|sd)\b/i, value: '480p' },
    ],
    source: [
        { pattern: /\b(?:bdremux|remux)\b/i, value: 'REMUX' },
        { pattern: /\b(?:bluray|blu-ray|bdrip|brrip)\b/i, value: 'BluRay' },
        { pattern: /\b(?:web-dl|webdl)\b/i, value: 'WEB-DL' },
        { pattern: /\b(?:web-rip|webrip|web)\b/i, value: 'WEBRip' },
        { pattern: /\b(?:hdtv|pdtv|dsr)\b/i, value: 'HDTV' },
        { pattern: /\b(?:cam|camrip|hdcam|ts|telesync|hdts)\b/i, value: 'CAM' },
    ],
    codec: [
        { pattern: /\b(?:av1)\b/i, value: 'AV1' },
        { pattern: /\b(?:x[._-]?265|h[._-]?265|hevc)\b/i, value: 'HEVC' },
        { pattern: /\b(?:x[._-]?264|h[._-]?264|avc)\b/i, value: 'AVC' },
        { pattern: /\b(?:xvid|divx)\b/i, value: 'XVID' },
    ],
    audioCodec: [
        { pattern: /\b(?:atmos)\b/i, value: 'Atmos' },
        { pattern: /\b(?:truehd)\b/i, value: 'TrueHD' },
        { pattern: /\b(?:dts-hd\s*ma|dts-hd)\b/i, value: 'DTS-HD MA' },
        { pattern: /\b(?:dts)\b/i, value: 'DTS' },
        { pattern: /(?:\b|[._\-])(?:eac3|ddp[._-]?[0-9]?\.?[0-9]?|dd\+|dolby\s*digital\s*plus)(?:\b|[._\-])/i, value: 'EAC3' },
        { pattern: /(?:\b|[._\-])(?:ac3|dd[._-]?5\.1|dd\b|dolby\s*digital)(?:\b|[._\-])/i, value: 'AC3' },
        { pattern: /\b(?:aac(?:\s*2\.0)?)\b/i, value: 'AAC' },
        { pattern: /\b(?:mp3)\b/i, value: 'MP3' },
    ],
    audioChannels: [
        { pattern: /(?:\b|[a-zA-Z])(?:7\.1|8ch)(?:\b|[._\-])/i, value: '7.1' },
        { pattern: /(?:\b|[a-zA-Z])(?:5\.1|6ch)(?:\b|[._\-])/i, value: '5.1' },
        { pattern: /(?:\b|[a-zA-Z])(?:2\.0|2ch|stereo)(?:\b|[._\-])/i, value: '2.0' },
    ],
    hdr: {
        dolbyVision: /(?:\b|[._\-])(?:dolby\s*vision|dv|dovi)(?:\b|[._\-])/i,
        hdr10plus: /(?:\b|[._\-])(?:hdr10\+|hdr10plus)(?:\b|[._\-])/i,
        hdr10: /(?:\b|[._\-])(?:hdr10)(?:\b|[._\-])/i,
        hdr: /(?:\b|[._\-])(?:hdr)(?:\b|[._\-])/i,
    },
    bitDepth: [
        { pattern: /\b(?:10-?bit|hi10p)\b/i, value: 10 },
        { pattern: /\b(?:8-?bit)\b/i, value: 8 },
    ],
    container: /\.(mkv|mp4|avi|mov|ts|m4v)$/i,
    flags: {
        proper: /\bproper\b/i,
        repack: /\b(?:repack|rerip)\b/i,
        remastered: /\b(?:remastered|remaster)\b/i,
    },
};
