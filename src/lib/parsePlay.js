// AppleCMS 播放地址格式解析（原样保留解析逻辑）
// vod_play_from: "线路1$$$线路2"
// vod_play_url:  "第1集$url#第2集$url$$$第1集$url#第2集$url"
function parsePlayData(from, urls) {
  const flags = String(from || '')
    .split('$$$')
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = String(urls || '').split('$$$');

  return flags.map((flag, i) => {
    const line = lines[i] || '';
    const episodes = line
      .split('#')
      .filter(Boolean)
      .map((seg) => {
        const idx = seg.indexOf('$');
        if (idx < 0) return { name: seg.trim(), url: seg.trim() };
        return { name: seg.slice(0, idx).trim(), url: seg.slice(idx + 1).trim() };
      });
    return { flag, episodes };
  });
}

export { parsePlayData };
