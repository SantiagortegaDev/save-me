// Recognizes well-known platforms from a URL. Pure, unit-tested in tests/.

export type PlatformKey =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'reddit'
  | 'pinterest'
  | 'threads'
  | 'facebook'
  | 'spotify'
  | 'linkedin'
  | 'vimeo'
  | 'soundcloud'
  | 'github'
  | 'medium'
  | 'amazon'
  | 'twitch'
  | 'web';

export type Platform = { key: PlatformKey; name: string; color: string };

const PLATFORMS: { key: PlatformKey; name: string; color: string; hosts: RegExp }[] = [
  { key: 'instagram', name: 'Instagram', color: '#E1306C', hosts: /(^|\.)(instagram\.com|instagr\.am)$/ },
  { key: 'tiktok', name: 'TikTok', color: '#111111', hosts: /(^|\.)tiktok\.com$/ },
  { key: 'youtube', name: 'YouTube', color: '#FF0000', hosts: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { key: 'x', name: 'X', color: '#111111', hosts: /(^|\.)(x\.com|twitter\.com)$/ },
  { key: 'reddit', name: 'Reddit', color: '#FF4500', hosts: /(^|\.)(reddit\.com|redd\.it)$/ },
  { key: 'pinterest', name: 'Pinterest', color: '#E60023', hosts: /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/ },
  { key: 'threads', name: 'Threads', color: '#111111', hosts: /(^|\.)threads\.(net|com)$/ },
  { key: 'facebook', name: 'Facebook', color: '#1877F2', hosts: /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/ },
  { key: 'spotify', name: 'Spotify', color: '#1DB954', hosts: /(^|\.)spotify\.com$/ },
  { key: 'linkedin', name: 'LinkedIn', color: '#0A66C2', hosts: /(^|\.)linkedin\.com$/ },
  { key: 'vimeo', name: 'Vimeo', color: '#1AB7EA', hosts: /(^|\.)vimeo\.com$/ },
  { key: 'soundcloud', name: 'SoundCloud', color: '#FF5500', hosts: /(^|\.)soundcloud\.com$/ },
  { key: 'github', name: 'GitHub', color: '#111111', hosts: /(^|\.)github\.com$/ },
  { key: 'medium', name: 'Medium', color: '#111111', hosts: /(^|\.)medium\.com$/ },
  { key: 'amazon', name: 'Amazon', color: '#FF9900', hosts: /(^|\.)(amazon\.[a-z.]+|amzn\.to|a\.co)$/ },
  { key: 'twitch', name: 'Twitch', color: '#9146FF', hosts: /(^|\.)twitch\.tv$/ },
];

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./, '');
  } catch {
    return '';
  }
}

export function detectPlatform(url: string): Platform {
  const h = host(url);
  const found = PLATFORMS.find((p) => p.hosts.test(h));
  return found ? { key: found.key, name: found.name, color: found.color } : { key: 'web', name: h || 'Web', color: '#8A8A8A' };
}

// A readable title when a platform hides its content from link previews.
export function fallbackTitle(url: string): string {
  const p = detectPlatform(url);
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    return p.name;
  }
  const seg = path.split('/').filter(Boolean);
  switch (p.key) {
    case 'instagram':
      if (seg[0] === 'reel' || seg[0] === 'reels') return 'Instagram reel';
      if (seg[0] === 'p') return 'Instagram post';
      if (seg[0] === 'stories' && seg[1]) return `Instagram story by @${seg[1]}`;
      return seg[0] ? `@${seg[0]} on Instagram` : 'Instagram';
    case 'tiktok':
      return seg[0]?.startsWith('@') ? `TikTok by ${seg[0]}` : 'TikTok video';
    case 'x':
      return seg[1] === 'status' ? `Post by @${seg[0]} on X` : seg[0] ? `@${seg[0]} on X` : 'X';
    case 'threads':
      return seg[0]?.startsWith('@') ? `Thread by ${seg[0]}` : 'Threads post';
    case 'reddit':
      if (seg[0] === 'r' && seg[1]) return seg[4] ? `${seg[4].replace(/_/g, ' ')} · r/${seg[1]}` : `r/${seg[1]}`;
      return 'Reddit post';
    case 'youtube':
      return seg[0] === 'shorts' ? 'YouTube Short' : 'YouTube video';
    case 'pinterest':
      return 'Pinterest pin';
    case 'facebook':
      return seg.includes('reel') || seg.includes('watch') ? 'Facebook video' : 'Facebook post';
    default:
      return p.name;
  }
}
