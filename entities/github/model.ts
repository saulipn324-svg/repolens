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
export const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export const str = (v: unknown, max = 500) =>
  typeof v === 'string' ? v.slice(0, max) : '';
export const number = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
export const validDate = (v: unknown) =>
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
