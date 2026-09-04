/**
 * 播放适配器（tesla-media-hub 内置播放库，基于 wody11/Tesla-VideoPlayer）
 *
 * 播放库来自 tesla-media-hub 内置资源，置于 public/assets/ 与 public/wasm/：
 *   - guard-e6d89b7c.js 导出 Player（m），其余 avplayer 分片为其内部相对 import
 *   - wasm 解码器以绝对路径 /wasm/*.wasm 加载
 *
 * 同时承载两套播放场景：
 *   - IPTV 直播：opts.live = true（默认），对应 m3u8/mpegts live 流的缓冲与 seek 策略
 *   - AppleCMS 点播：opts.live = false，对应 HLS/MP4 VOD，启用 seek / 缓冲更宽
 *
 * 服务端不做改动（AppleCMS 点播仍走原站直连，不经服务端 ffmpeg；IPTV 走 /stream/...ts）。
 *
 * 任意一步失败（库缺失 / 浏览器不支持 WebCodecs / 流无响应）都会抛错或回调 onError，
 * 由调用方给出失败提示。
 */

let _mod = null;
let _modLoading = null;

function loadModule() {
  if (_mod) return Promise.resolve(_mod);
  if (!_modLoading) {
    _modLoading = import('/assets/guard-e6d89b7c.js')
      .then((m) => {
        _mod = m;
        return m;
      })
      .catch((e) => {
        _modLoading = null;
        throw e;
      });
  }
  return _modLoading;
}

function isSupported() {
  return (
    typeof window !== 'undefined' &&
    'VideoDecoder' in window &&
    'AudioDecoder' in window &&
    typeof window.Worker === 'function'
  );
}

const DECODE_PRESET_HARDWARE = 'hardware';
const DECODE_PRESET_SOFTWARE = 'software';
const FIRST_FRAME_TIMEOUT_MS = 15000;

/**
 * 创建并启动一个播放实例（同时承载 IPTV 直播与 AppleCMS 点播）
 * @param {HTMLElement} hostEl 播放器挂载容器
 * @param {string} url 播放地址（HLS / MP4 / MPEG-TS 等）
 * @param {object} opts { live, onFirstFrame, onError, onEnded, onStatus, onTime }
 *   - live：是否直播模式（默认 true）。点播场景（如 AppleCMS 电影）须传 false，
 *           以启用缓冲/seek 策略。
 *   - onTime：点播时间更新回调 (currentTime, duration)，用于「末集停在末帧」判定。
 * @returns {Promise<object>} 句柄 { destroy, pause, getCurrentTime, getDuration }
 */
async function createPlayer(hostEl, url, opts = {}) {
  if (!isSupported()) throw new Error('当前浏览器不支持 WebCodecs（播放所需）');

  const mod = await loadModule();
  const Player = mod.m || mod.default || mod.Player;
  if (typeof Player !== 'function') throw new Error('播放库未导出 Player');

  const live = opts.live !== false; // 默认 live（IPTV）；AppleCMS 点播传 false
  const errorMsg = live ? '直播源无响应' : '片源无响应';

  let decodePresetId = DECODE_PRESET_HARDWARE;
  let player = null;
  let destroyed = false;
  let firstFrameOk = false;
  let fallbackTimer = null;

  function clearTimers() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function destroy() {
    destroyed = true;
    clearTimers();
    const p = player;
    player = null;
    if (!p) return;
    try {
      const god = p.god;
      p.god = null;
      if (god && typeof god.destroy === 'function') god.destroy();
    } catch (_) { /* ignore */ }
    try {
      if (typeof p.destroy === 'function') p.destroy();
    } catch (_) { /* ignore */ }
    if (hostEl) hostEl.innerHTML = '';
  }

  async function start(fallback) {
    if (destroyed) return;
    if (fallback) decodePresetId = DECODE_PRESET_SOFTWARE;

    // 重建前先销毁旧实例（切换硬/软解或重试）
    if (player) {
      try {
        if (typeof player.destroy === 'function') player.destroy();
      } catch (_) { /* ignore */ }
      player = null;
    }
    if (hostEl) hostEl.innerHTML = '';

    player = new Player({
      container: hostEl,
      loop: false,
      isLive: live,
      decodePresetId,
    });

    player.on('time', () => {
      if (!firstFrameOk) markFirstFrame();
      if (typeof opts.onTime === 'function') {
        let ct = 0, dur = 0;
        try { ct = player.currentTime || 0; } catch (_) { /* ignore */ }
        try { dur = player.duration || 0; } catch (_) { /* ignore */ }
        opts.onTime(ct, dur);
      }
    });
    player.on('firstVideoRendered', () => markFirstFrame());
    player.on('firstAudioRendered', () => markFirstFrame());
    player.on('ended', () => {
      if (typeof opts.onEnded === 'function') opts.onEnded();
    });

    function markFirstFrame() {
      if (firstFrameOk) return;
      firstFrameOk = true;
      clearTimers();
      if (typeof opts.onFirstFrame === 'function') opts.onFirstFrame();
    }

    try {
      player.loadSource(url, { isLive: live }, true);
    } catch (e) {
      if (typeof opts.onError === 'function') opts.onError(e);
      return;
    }

    // 首帧超时：硬解无响应则回退软解重建；软解仍无响应则报错
    fallbackTimer = setTimeout(() => {
      if (destroyed || firstFrameOk) return;
      if (decodePresetId === DECODE_PRESET_HARDWARE && !fallback) {
        if (typeof opts.onStatus === 'function') {
          opts.onStatus('硬解无响应，切换兼容模式…');
        }
        start(true);
      } else if (typeof opts.onError === 'function') {
        opts.onError(new Error(errorMsg));
      }
    }, FIRST_FRAME_TIMEOUT_MS);
  }

  await start(false);

  return {
    destroy,
    pause() {
      if (player && typeof player.pause === 'function') {
        try { player.pause(); } catch (_) { /* ignore */ }
      }
    },
    getCurrentTime() {
      try { return player ? (player.currentTime || 0) : 0; } catch (_) { return 0; }
    },
    getDuration() {
      try { return player ? (player.duration || 0) : 0; } catch (_) { return 0; }
    },
  };
}

window.IptvAdapter = { isSupported, createPlayer };
