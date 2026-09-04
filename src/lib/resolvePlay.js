import { fetchText } from './fetcher.js';

const DIRECT_RE = /\.(m3u8|mp4|flv|mkv|ts|webm|mov|mp3|aac|ogg)(\?|#|$)/i;

// 解析播放地址：直链直接返回；HTML 跳转页则抓取页面提取真实视频地址；失败原样返回
async function resolvePlayUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return url;
  if (/^(blob|data):/i.test(url)) return url;
  if (DIRECT_RE.test(url)) return url;

  try {
    const html = await fetchText(url);
    if (!html || !/<(html|!doctype)/i.test(html)) return url;

    const patterns = [
      /url\s*[:=]\s*["']([^"']*\.(?:m3u8|mp4|flv|webm|ts|mkv)[^"']*)["']/i,
      /(?:src|href)\s*[:=]\s*["'](https?:\/\/[^"'\s]+\.(?:m3u8|mp4|flv|webm|ts|mkv)[^"'\s]*)["']/i,
      /(https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|flv|webm|ts|mkv)[^"'\s<>]*)/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) {
        const found = m[1];
        if (/^https?:\/\//i.test(found)) return found;
        try {
          return new URL(found, url).toString();
        } catch (e) {
          return found;
        }
      }
    }
  } catch (e) {
    /* 解析失败返回原地址 */
  }
  return url;
}

export { resolvePlayUrl };
