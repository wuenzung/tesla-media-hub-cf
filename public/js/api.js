/**
 * API 请求封装
 * opts.headers 可与默认 JSON 头合并；opts.token 自动附加 Authorization
 */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const init = { ...opts, headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await fetch(path, init);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('服务响应异常');
  }
  if (!data.code) throw new Error(data.msg || '请求失败');
  return data;
}
