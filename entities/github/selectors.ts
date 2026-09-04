import type { Repo, Event } from './model.ts';
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
