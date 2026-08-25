export interface RouteTarget {
  /** 库条目 slug；null = 不在条目页 */
  slug: string | null;
  /** 是否演示模式 */
  present: boolean;
}

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export function parseRoute(search: string): RouteTarget {
  const params = new URLSearchParams(search);
  const raw = params.get('r') ?? '';
  const slug = SLUG_RE.test(raw) ? raw : null;
  return { slug, present: params.get('mode') === 'present' };
}

/** 更新 URL 查询参数并通知应用内监听者（不触发真实导航） */
export function updateRouteParams(updates: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.pushState({}, '', url);
  window.dispatchEvent(new Event('chemai-route'));
}
