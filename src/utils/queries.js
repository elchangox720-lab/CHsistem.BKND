export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePagination(query, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(String(query?.page ?? ''), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query?.limit ?? ''), 10) || defaultLimit)
  );

  return { page, limit, skip: (page - 1) * limit };
}

export function pageResult(items, total, page, limit) {
  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function oneOf(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : undefined;
}

export function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function boolFilter(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
