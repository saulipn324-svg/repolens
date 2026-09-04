import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  username,
  normalizeRepos,
  filterRepos,
  languages,
  activity,
  loadDashboard,
  clearCache,
  GitHubError,
} from '../entities/github/index.ts';
const raw = (id, name, extra = {}) => ({
  id,
  name,
  language: 'Java',
  stargazers_count: 3,
  forks_count: 1,
  pushed_at: '2026-09-01T00:00:00Z',
  ...extra,
});
const profile = {
  login: 'octocat',
  name: 'Octocat',
  public_repos: 2,
  followers: 10,
};
const ok = (data, headers = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
beforeEach(() => clearCache());
test('valida nombres sin permitir rutas o URLs', () => {
  assert.equal(username(' @Octocat '), 'Octocat');
  for (const input of [
    'https://github.com/a',
    '../a',
    'a/b',
    '-abc',
    'a--b',
    'a b',
    '',
  ])
    assert.throws(() => username(input), GitHubError);
});
test('normaliza nulos, descarta privados y construye URLs seguras', () => {
  const [r] = normalizeRepos(
    [
      raw(1, 'project', {
        language: null,
        pushed_at: 'bad',
        stargazers_count: -3,
        html_url: 'javascript:alert(1)',
      }),
      raw(2, 'secret', { private: true }),
    ],
    'octocat',
  );
  assert.equal(r.language, 'Sin lenguaje');
  assert.equal(r.pushedAt, null);
  assert.equal(r.stars, 0);
  assert.equal(r.url, 'https://github.com/octocat/project');
});
test('filtros combinados, orden estable y colección original intacta', () => {
  const repos = normalizeRepos(
    [
      raw(1, 'beta'),
      raw(2, 'alpha'),
      raw(3, 'fork', { fork: true }),
      raw(4, 'archive', { archived: true }),
      raw(5, 'web', { language: 'TypeScript' }),
    ],
    'octocat',
  );
  assert.deepEqual(
    filterRepos(repos, '', 'Java', false, false, 'stars').map((r) => r.name),
    ['alpha', 'beta'],
  );
  assert.equal(filterRepos(repos, 'WEB', 'all', true, true, 'name').length, 1);
  assert.equal(repos[0].name, 'beta');
});
test('lenguajes cuentan repositorios incluso sin detección', () => {
  const repos = normalizeRepos(
    [raw(1, 'a'), raw(2, 'b'), raw(3, 'c', { language: null })],
    'octocat',
  );
  assert.deepEqual(languages(repos), [
    { name: 'Java', count: 2 },
    { name: 'Sin lenguaje', count: 1 },
  ]);
});
test('actividad usa 14 días UTC, excluye eventos fuera de rango y duplicados', () => {
  const rows = activity(
    [
      { id: 'a', date: '2026-09-02T23:00:00Z' },
      { id: 'a', date: '2026-09-02T23:00:00Z' },
      { id: 'b', date: '2026-08-01T00:00:00Z' },
    ],
    new Date('2026-09-02T12:00:00Z'),
  );
  assert.equal(rows.length, 14);
  assert.equal(rows.at(-1).count, 1);
  assert.equal(
    rows.reduce((n, r) => n + r.count, 0),
    1,
  );
});
test('carga perfil, repositorios y eventos; reutiliza cache', async () => {
  let calls = 0;
  const mock = async (url) => {
    calls++;
    return ok(
      url.includes('/repos?')
        ? [raw(1, 'a')]
        : url.includes('/events/')
          ? []
          : profile,
      { 'x-ratelimit-remaining': '55' },
    );
  };
  const a = await loadDashboard('octocat', undefined, mock);
  const b = await loadDashboard('OCTOCAT', undefined, mock);
  assert.equal(a, b);
  assert.equal(calls, 3);
  assert.equal(a.remaining, 55);
  assert.equal(a.eventsAvailable, true);
});
test('404 conserva un mensaje útil', async () => {
  await assert.rejects(
    loadDashboard(
      'missing',
      undefined,
      async () => new Response('{}', { status: 404 }),
    ),
    (e) => e.status === 404 && e.message.includes('cuenta'),
  );
});
test('403 comunica la fecha de recuperación de cuota', async () => {
  await assert.rejects(
    loadDashboard(
      'limited',
      undefined,
      async () =>
        new Response('{}', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1800000000',
          },
        }),
    ),
    (e) => e.status === 403 && e.resetAt === 1800000000000,
  );
});
test('falla de eventos conserva repositorios y señala información ausente', async () => {
  const result = await loadDashboard('octocat', undefined, async (url) =>
    url.includes('/events/')
      ? new Response('{}', { status: 503 })
      : ok(url.includes('/repos?') ? [raw(1, 'a')] : profile),
  );
  assert.equal(result.repos.length, 1);
  assert.equal(result.eventsAvailable, false);
  assert.equal(result.warnings.length, 1);
});
test('paginación acumula y elimina duplicados', async () => {
  let pages = 0;
  const batch = Array.from({ length: 100 }, (_, i) => raw(i, 'r' + i));
  const result = await loadDashboard('octocat', undefined, async (url) => {
    if (url.includes('/repos?')) {
      pages++;
      return ok(pages === 1 ? batch : [batch[0], raw(101, 'new')]);
    }
    return ok(url.includes('/events/') ? [] : profile);
  });
  assert.equal(pages, 2);
  assert.equal(result.repos.length, 101);
  assert.equal(result.truncated, false);
});
test('límite de cinco páginas informa que la muestra está truncada', async () => {
  let pages = 0;
  const result = await loadDashboard('octocat', undefined, async (url) => {
    if (url.includes('/repos?')) {
      const page = pages++;
      return ok(
        Array.from({ length: 100 }, (_, i) =>
          raw(page * 100 + i, 'r' + (page * 100 + i)),
        ),
      );
    }
    return ok(url.includes('/events/') ? [] : profile);
  });
  assert.equal(pages, 5);
  assert.equal(result.repos.length, 500);
  assert.equal(result.truncated, true);
});
test('error en páginas posteriores conserva datos parciales con aviso', async () => {
  let pages = 0;
  const result = await loadDashboard('octocat', undefined, async (url) => {
    if (url.includes('/repos?'))
      return ++pages === 1
        ? ok(Array.from({ length: 100 }, (_, i) => raw(i, 'r' + i)))
        : new Response('{}', { status: 502 });
    return ok(url.includes('/events/') ? [] : profile);
  });
  assert.equal(result.repos.length, 100);
  assert.equal(result.truncated, true);
  assert.ok(result.warnings.length);
});
test('una consulta cancelada no se añade a la caché', async () => {
  const c = new AbortController();
  c.abort();
  let calls = 0;
  await assert.rejects(
    loadDashboard('octocat', c.signal, async () => {
      calls++;
      return ok(profile);
    }),
  );
  assert.equal(calls, 0);
});
test('JSON y listas inválidas fallan de forma controlada', async () => {
  await assert.rejects(
    loadDashboard('octocat', undefined, async () => new Response('not json')),
    (e) => e.status === 502,
  );
  assert.throws(() => normalizeRepos({}, 'octocat'), GitHubError);
});
test('fallo de red presenta un error recuperable', async () => {
  await assert.rejects(
    loadDashboard('octocat', undefined, async () => {
      throw new TypeError('network');
    }),
    (e) => e.message.includes('conexión'),
  );
});
