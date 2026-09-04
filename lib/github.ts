export type Repo = {
  id: number;
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  fork: boolean;
  archived: boolean;
  pushedAt: string | null;
  url: string;
};
export type Profile = {
  login: string;
  name: string;
  bio: string;
  publicRepos: number;
  followers: number;
  type: string;
  url: string;
};
export type Event = { id: string; type: string; repo: string; date: string };
export type Dashboard = {
  profile: Profile;
  repos: Repo[];
  events: Event[];
  eventsAvailable: boolean;
  warnings: string[];
  fetchedAt: string;
  remaining: number | null;
  resetAt: number | null;
  truncated: boolean;
};
export class GitHubError extends Error {
  status: number;
  resetAt: number | null;
  constructor(message: string, status = 0, resetAt: number | null = null) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.resetAt = resetAt;
  }
}
export function username(value: string): string {
  const name = value.trim().replace(/^@/, '');
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(name) || name.includes('--'))
    throw new GitHubError('Escribe un usuario válido, sin URL ni espacios.');
  return name;
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const str = (v: unknown, max = 500) =>
  typeof v === 'string' ? v.slice(0, max) : '';
const number = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const validDate = (v: unknown) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null;
export function normalizeRepos(value: unknown, login: string): Repo[] {
  if (!Array.isArray(value))
    throw new GitHubError(
      'GitHub devolvió una lista de repositorios inválida.',
      502,
    );
  return value
    .map(object)
    .filter(
      (r) =>
        typeof r.id === 'number' &&
        typeof r.name === 'string' &&
        r.private !== true,
    )
    .map((r) => ({
      id: number(r.id),
      name: str(r.name, 100),
      description: str(r.description),
      language: str(r.language, 80) || 'Sin lenguaje',
      stars: number(r.stargazers_count),
      forks: number(r.forks_count),
      fork: r.fork === true,
      archived: r.archived === true,
      pushedAt: validDate(r.pushed_at),
      url: `https://github.com/${encodeURIComponent(login)}/${encodeURIComponent(str(r.name, 100))}`,
    }));
}
export function filterRepos(
  repos: Repo[],
  query: string,
  language: string,
  includeForks: boolean,
  includeArchived: boolean,
  sort: string,
): Repo[] {
  const term = query.trim().toLocaleLowerCase('es');
  return repos
    .filter(
      (r) =>
        (includeForks || !r.fork) &&
        (includeArchived || !r.archived) &&
        (language === 'all' || r.language === language) &&
        `${r.name} ${r.description}`.toLocaleLowerCase('es').includes(term),
    )
    .sort((a, b) => {
      const order =
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'recent'
            ? (Date.parse(b.pushedAt || '') || 0) -
              (Date.parse(a.pushedAt || '') || 0)
            : sort === 'forks'
              ? b.forks - a.forks
              : b.stars - a.stars;
      return order || a.name.localeCompare(b.name) || a.id - b.id;
    });
}
export function languages(repos: Repo[]) {
  const counts = new Map<string, number>();
  for (const r of repos)
    counts.set(r.language, (counts.get(r.language) || 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export function activity(events: Event[], now = new Date()) {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const rows = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(end - (13 - i) * 86400000).toISOString().slice(0, 10),
    count: 0,
  }));
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const row = rows.find((r) => r.date === event.date.slice(0, 10));
    if (row) row.count++;
  }
  return rows;
}
export const eventLabel = (type: string) =>
  ({
    PushEvent: 'Publicación de cambios',
    CreateEvent: 'Creación de referencia',
    WatchEvent: 'Estrella añadida',
    ForkEvent: 'Fork creado',
    IssuesEvent: 'Actividad en incidencia',
    IssueCommentEvent: 'Comentario en incidencia',
    PullRequestEvent: 'Actividad en pull request',
    PullRequestReviewEvent: 'Revisión de código',
    ReleaseEvent: 'Publicación de versión',
    DeleteEvent: 'Referencia eliminada',
  })[type] || 'Evento público';

// A small tab-local cache reduces repeated API calls; it is not durable storage.
const cache = new Map<string, Dashboard>();
export function clearCache() {
  cache.clear();
}
export async function loadDashboard(
  raw: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Dashboard> {
  const name = username(raw),
    key = name.toLowerCase(),
    cached = cache.get(key);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 300000)
    return cached;
  let remaining: number | null = null,
    resetAt: number | null = null;
  async function get(path: string) {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(12000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetcher('https://api.github.com' + path, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
        },
        signal: combined,
        credentials: 'omit',
        redirect: 'error',
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new GitHubError(
        timeout.aborted
          ? 'GitHub tardó demasiado en responder. Intenta nuevamente.'
          : 'No se pudo conectar con GitHub. Revisa tu conexión e intenta nuevamente.',
      );
    }
    const left = response.headers.get('x-ratelimit-remaining'),
      reset = response.headers.get('x-ratelimit-reset');
    if (left !== null && Number.isFinite(Number(left)))
      remaining = Number(left);
    if (reset !== null && Number.isFinite(Number(reset)))
      resetAt = Number(reset) * 1000;
    if (!response.ok) {
      if (response.status === 404)
        throw new GitHubError(
          'No se encontró esa cuenta pública de GitHub.',
          404,
        );
      if (response.status === 403 || response.status === 429) {
        const retry = response.headers.get('retry-after');
        const until =
          retry && Number.isFinite(Number(retry))
            ? Date.now() + Number(retry) * 1000
            : resetAt;
        throw new GitHubError(
          'GitHub limitó temporalmente las consultas. Espera antes de volver a buscar.',
          response.status,
          until,
        );
      }
      throw new GitHubError(
        'GitHub no pudo completar la consulta. Intenta más tarde.',
        response.status,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new GitHubError('La respuesta de GitHub no es válida.', 502);
    }
  }
  const user = object(await get('/users/' + encodeURIComponent(name)));
  if (typeof user.login !== 'string')
    throw new GitHubError('GitHub devolvió un perfil inválido.', 502);
  const login = username(user.login);
  const profile: Profile = {
    login,
    name: str(user.name, 120) || login,
    bio: str(user.bio),
    publicRepos: number(user.public_repos),
    followers: number(user.followers),
    type: user.type === 'Organization' ? 'Organización' : 'Usuario',
    url: 'https://github.com/' + encodeURIComponent(login),
  };
  let repos: Repo[] = [],
    truncated = false;
  const warnings: string[] = [];
  for (let page = 1; page <= 5; page++) {
    try {
      const rawRepos = await get(
        `/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=${page}`,
      );
      const batch = normalizeRepos(rawRepos, login);
      repos.push(...batch);
      if ((rawRepos as unknown[]).length < 100) break;
      if (page === 5) truncated = true;
    } catch (e) {
      if (signal?.aborted) throw e;
      if (page === 1) throw e;
      truncated = true;
      warnings.push(
        'Solo se cargó una parte de los repositorios. ' +
          (e instanceof Error ? e.message : ''),
      );
      break;
    }
  }
  repos = [...new Map(repos.map((r) => [r.id, r])).values()];
  if (truncated)
    warnings.push(
      'Las métricas corresponden a los repositorios cargados (máximo 500), no necesariamente a toda la cuenta.',
    );
  let events: Event[] = [],
    eventsAvailable = false;
  try {
    const data = await get(
      `/users/${encodeURIComponent(login)}/events/public?per_page=100`,
    );
    if (!Array.isArray(data))
      throw new GitHubError('Respuesta de actividad inválida.');
    events = data
      .map(object)
      .filter((e) => typeof e.id === 'string' && validDate(e.created_at))
      .map((e) => ({
        id: str(e.id, 100),
        type: str(e.type, 80),
        repo: str(object(e.repo).name, 180),
        date: String(e.created_at),
      }));
    eventsAvailable = true;
  } catch (e) {
    if (signal?.aborted) throw e;
    warnings.push(
      'Actividad no disponible. ' + (e instanceof Error ? e.message : ''),
    );
  }
  signal?.throwIfAborted();
  const result = {
    profile,
    repos,
    events,
    eventsAvailable,
    warnings,
    fetchedAt: new Date().toISOString(),
    remaining,
    resetAt,
    truncated,
  };
  if (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
