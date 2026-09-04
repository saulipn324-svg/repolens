import {
  username,
  normalizeRepos,
  GitHubError,
  object,
  str,
  number,
  validDate,
  type Dashboard,
  type Profile,
  type Repo,
  type Event,
} from './model.ts';
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
