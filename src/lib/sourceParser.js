// 源解析：本部署仅支持 AppleCMS（IPTV 已移除）
// 站点模型: { key, name, sourceType, api }
function parseSource(source) {
  const type = String(source.type || 'applecms').toLowerCase();
  if (type === 'applecms') {
    return [
      {
        key: `${source.id}::main`,
        name: source.name,
        sourceType: 'applecms',
        api: String(source.url || '').trim(),
      },
    ];
  }
  // iptv 类型在本部署已禁用
  throw new Error('IPTV 功能已禁用（本部署已移除）');
}

export { parseSource };
