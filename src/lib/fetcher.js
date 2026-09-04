// HTTP 请求封装 —— 仅用 Worker 全局 fetch，无 node 依赖
const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_TIMEOUT = 15000;

async function fetchText(url, opts = {}) {
  const { headers = {}, timeout = DEFAULT_TIMEOUT, method = 'GET', body } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': DEFAULT_UA, Accept: '*/*', ...headers },
      body,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON parse failed for ${url}: ${text.slice(0, 300)}`);
  }
}

// 用于流式代理转发（图片代理）
async function fetchStream(url, opts = {}) {
  const { headers = {}, timeout = 20000, redirect = 'follow' } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': DEFAULT_UA, Accept: '*/*', ...headers },
      signal: ctrl.signal,
      redirect,
    });
  } finally {
    clearTimeout(timer);
  }
}

export { fetchText, fetchJson, fetchStream };
