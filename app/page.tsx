'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ArrowUpRight,
  ChartNoAxesCombined,
  BookOpen,
  Star,
  GitFork,
  Activity,
  Users,
  RefreshCw,
  Info,
  ArrowDown,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import {
  loadDashboard,
  username,
  filterRepos,
  languages,
  activity,
  eventLabel,
  GitHubError,
  type Dashboard,
} from '@/lib/github';
const colors = [
  '#c8f36b',
  '#72c6f0',
  '#b799ed',
  '#f1bd76',
  '#f294a6',
  '#91a5bd',
];
const fmt = (n: number) => new Intl.NumberFormat('es-MX').format(n);
const date = (s: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(s));
export default function Home() {
  const [input, setInput] = useState(''),
    [data, setData] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<GitHubError | null>(null);
  const [query, setQuery] = useState(''),
    [language, setLanguage] = useState('all'),
    [sort, setSort] = useState('stars'),
    [forks, setForks] = useState(true),
    [archived, setArchived] = useState(true),
    [limit, setLimit] = useState(20);
  const active = useRef<AbortController | null>(null),
    sequence = useRef(0);
  const search = useCallback(async (value: string) => {
    let name: string;
    try {
      name = username(value);
    } catch (e) {
      setError(e as GitHubError);
      throw e;
    }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const id = ++sequence.current;
    setInput(name);
    setLoading(true);
    setError(null);
    setData(null);
    setQuery('');
    setLanguage('all');
    setSort('stars');
    setForks(true);
    setArchived(true);
    setLimit(20);
    try {
      const result = await loadDashboard(name, controller.signal);
      if (id === sequence.current && !controller.signal.aborted)
        setData(result);
      return {
        login: result.profile.login,
        repositories: result.repos.length,
        partial: result.truncated,
      };
    } catch (e) {
      if (!controller.signal.aborted && id === sequence.current)
        setError(
          e instanceof GitHubError
            ? e
            : new GitHubError('No se pudo completar la consulta.'),
        );
      throw e;
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        ctx.registerTool(
          {
            name: 'explore_github_account',
            title: 'Explorar cuenta de GitHub',
            description:
              'Consulta datos públicos de una cuenta y actualiza el dashboard. No modifica GitHub.',
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            inputSchema: {
              type: 'object',
              properties: {
                username: { type: 'string', minLength: 1, maxLength: 39 },
              },
              required: ['username'],
              additionalProperties: false,
            },
            execute: async (value: unknown) => {
              if (
                !value ||
                typeof value !== 'object' ||
                typeof (value as { username?: unknown }).username !== 'string'
              )
                throw Error('Se requiere username.');
              return await search((value as { username: string }).username);
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [search]);
  useEffect(() => setLimit(20), [query, language, sort, forks, archived]);
  const filtered = useMemo(
    () =>
      filterRepos(data?.repos || [], query, language, forks, archived, sort),
    [data, query, language, forks, archived, sort],
  );
  const langs = useMemo(() => languages(filtered), [filtered]);
  const chartLangs =
    langs.length > 6
      ? [
          ...langs.slice(0, 5),
          {
            name: 'Otros lenguajes',
            count: langs.slice(5).reduce((n, l) => n + l.count, 0),
          },
        ]
      : langs;
  const top = [...filtered]
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((r) => ({ name: r.name, stars: r.stars }));
  const days = useMemo(
    () =>
      activity(
        data?.events || [],
        data ? new Date(data.fetchedAt) : new Date(),
      ),
    [data],
  );
  const eventTotal = days.reduce((n, d) => n + d.count, 0);
  const run = (s: string) => void search(s).catch(() => {});
  const reset = () => {
    setQuery('');
    setLanguage('all');
    setSort('stars');
    setForks(true);
    setArchived(true);
  };
  return (
    <main>
      <header>
        <a className="brand" href="/">
          <ChartNoAxesCombined size={26} />
          Repo<span>Lens</span>
        </a>
        <span className="header-label">GITHUB / EXPLORADOR DE DATOS</span>
        <a href="/guia.html">
          Documentación <ArrowUpRight size={16} />
        </a>
      </header>
      <section className="search-section">
        <div>
          <p className="eyebrow">DE LOS REPOSITORIOS A LA PERSPECTIVA</p>
          <h1>Explora lo que se construye.</h1>
          <p className="lead">
            Repositorios, lenguajes y actividad pública de GitHub, en un solo
            lugar.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
          }}
          className="search-form"
        >
          <label htmlFor="username">Usuario u organización de GitHub</label>
          <div>
            <span aria-hidden="true">@</span>
            <Input
              id="username"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="octocat"
              maxLength={40}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <Button type="submit">
              <Search size={18} />
              {loading ? 'Buscar otra' : 'Explorar'}
            </Button>
          </div>
          <p>Solo datos públicos · Sin cuenta ni token</p>
        </form>
      </section>
      {error && (
        <div className="notice error" role="alert">
          <Info size={20} />
          <div>
            <strong>No se pudo completar la búsqueda.</strong>
            <p>
              {error.message}
              {error.resetAt && (
                <>
                  {' '}
                  Puedes intentar después de las{' '}
                  {new Date(error.resetAt).toLocaleTimeString('es-MX')}.
                </>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => run(input)}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Reintentar
          </Button>
        </div>
      )}
      {loading ? (
        <section
          className="loading"
          aria-busy="true"
          aria-label="Consultando GitHub"
        >
          <p role="status">Consultando @{input}…</p>
          <Skeleton className="h-20 w-full" />
          <div className="stats">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <Button
            variant="outline"
            onClick={() => {
              active.current?.abort();
              sequence.current++;
              setLoading(false);
            }}
          >
            Cancelar consulta
          </Button>
        </section>
      ) : !data ? (
        <>
          <Empty className="empty-start">
            <EmptyHeader>
              <div className="lens-icon">
                <Search size={30} />
              </div>
              <EmptyTitle className="text-2xl">
                Una cuenta. Toda una perspectiva.
              </EmptyTitle>
              <EmptyDescription className="text-base">
                Escribe un usuario para descubrir sus repositorios y qué
                lenguajes utiliza.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => run('octocat')}>
              Probar con octocat <ArrowUpRight size={16} />
            </Button>
          </Empty>
          <section className="preview-grid">
            {[
              {
                Icon: BookOpen,
                title: 'Repositorios',
                text: 'Explora proyectos y filtra por lenguaje.',
              },
              {
                Icon: Star,
                title: 'Estrellas',
                text: 'Descubre los repositorios más destacados.',
              },
              {
                Icon: Activity,
                title: 'Actividad',
                text: 'Consulta eventos públicos recientes.',
              },
            ].map(({ Icon, title, text }) => (
              <article key={title}>
                <Icon size={20} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </section>
        </>
      ) : (
        <>
          <section className="profile">
            <div className="initials" aria-hidden="true">
              {data.profile.login.slice(0, 2).toUpperCase()}
            </div>
            <div className="profile-info">
              <p className="eyebrow">{data.profile.type} / PERFIL PÚBLICO</p>
              <h2>
                {data.profile.name}
                <span>@{data.profile.login}</span>
              </h2>
              {data.profile.bio && <p>{data.profile.bio}</p>}
            </div>
            <div className="profile-side">
              <a
                href={data.profile.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver en GitHub <ExternalLink size={15} />
              </a>
              <span>
                <Users size={14} />
                {fmt(data.profile.followers)} seguidores
              </span>
            </div>
          </section>
          <div className="data-meta">
            <span>
              Consulta: {new Date(data.fetchedAt).toLocaleString('es-MX')} · Se
              reutiliza durante 5 min en esta pestaña
            </span>
            <span>
              {data.remaining === null
                ? 'Cuota no disponible'
                : `${data.remaining} consultas restantes reportadas`}
            </span>
          </div>
          {data.warnings.map((w, i) => (
            <div className="notice" key={i} role="status">
              <Info size={18} />
              <p>{w}</p>
            </div>
          ))}
          <section className="filters" aria-label="Filtros de repositorios">
            <div className="filter-search">
              <label htmlFor="filter">Buscar repositorio</label>
              <Input
                id="filter"
                placeholder="Nombre o descripción"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label>
              Lenguaje
              <NativeSelect
                aria-label="Lenguaje"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <NativeSelectOption value="all">
                  Todos los lenguajes
                </NativeSelectOption>
                {languages(data.repos).map((l) => (
                  <NativeSelectOption key={l.name} value={l.name}>
                    {l.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label>
              Ordenar por
              <NativeSelect
                aria-label="Ordenar por"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <NativeSelectOption value="stars">
                  Más estrellas
                </NativeSelectOption>
                <NativeSelectOption value="recent">
                  Último push
                </NativeSelectOption>
                <NativeSelectOption value="forks">Más forks</NativeSelectOption>
                <NativeSelectOption value="name">Nombre A–Z</NativeSelectOption>
              </NativeSelect>
            </label>
            <div className="checks">
              <label>
                <Checkbox
                  checked={forks}
                  onCheckedChange={(v) => setForks(v)}
                />
                Incluir forks
              </label>
              <label>
                <Checkbox
                  checked={archived}
                  onCheckedChange={(v) => setArchived(v)}
                />
                Incluir archivados
              </label>
            </div>
          </section>
          <div className="scope">
            <span>
              {fmt(filtered.length)} de {fmt(data.repos.length)} repositorios
              cargados · {fmt(data.profile.publicRepos)} públicos reportados por
              GitHub
            </span>
            <Button variant="ghost" onClick={reset}>
              Limpiar filtros
            </Button>
          </div>
          <section
            className="stats"
            aria-label="Métricas de los repositorios filtrados"
          >
            {[
              {
                Icon: BookOpen,
                label: 'Repositorios filtrados',
                value: filtered.length,
              },
              {
                Icon: Star,
                label: 'Estrellas acumuladas',
                value: filtered.reduce((n, r) => n + r.stars, 0),
              },
              {
                Icon: GitFork,
                label: 'Forks acumulados',
                value: filtered.reduce((n, r) => n + r.forks, 0),
              },
              {
                Icon: ChartNoAxesCombined,
                label: 'Lenguajes identificados',
                value: langs.filter((l) => l.name !== 'Sin lenguaje').length,
              },
            ].map(({ Icon, label, value }) => (
              <article key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={18} />
                </div>
                <strong>{fmt(value)}</strong>
                <small>En la selección actual</small>
              </article>
            ))}
          </section>
          {filtered.length > 0 ? (
            <section className="charts">
              <article className="panel">
                <div className="panel-title">
                  <div>
                    <p className="eyebrow">DISTRIBUCIÓN</p>
                    <h2>Lenguajes principales</h2>
                  </div>
                  <span>{filtered.length} repos</span>
                </div>
                <div className="language-chart">
                  <ChartContainer
                    config={{
                      count: { label: 'Repositorios', color: '#c8f36b' },
                    }}
                    className="donut"
                  >
                    <PieChart accessibilityLayer>
                      <Pie
                        data={chartLangs}
                        dataKey="count"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={2}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {chartLangs.map((l, i) => (
                          <Cell key={l.name} fill={colors[i % colors.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={<ChartTooltipContent nameKey="name" />}
                      />
                    </PieChart>
                  </ChartContainer>
                  <ul className="legend">
                    {chartLangs.map((l, i) => (
                      <li key={l.name}>
                        <span
                          className="dot"
                          style={{ background: colors[i % colors.length] }}
                        />
                        <span>{l.name}</span>
                        <strong>{l.count}</strong>
                        <small>
                          {Math.round((l.count / filtered.length) * 100)}%
                        </small>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="note">
                  Número de repositorios por lenguaje principal; no mide líneas
                  de código.
                </p>
              </article>
              <article className="panel">
                <div className="panel-title">
                  <div>
                    <p className="eyebrow">POPULARIDAD</p>
                    <h2>Repositorios con más estrellas</h2>
                  </div>
                  <Star size={18} />
                </div>
                {top.some((r) => r.stars > 0) ? (
                  <ChartContainer
                    config={{ stars: { label: 'Estrellas', color: '#c8f36b' } }}
                    className="star-chart"
                  >
                    <BarChart
                      data={top}
                      layout="vertical"
                      accessibilityLayer
                      margin={{ left: 0, right: 52, top: 10, bottom: 5 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tickFormatter={(n) =>
                          Intl.NumberFormat('es-MX', {
                            notation: 'compact',
                          }).format(n)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={115}
                        tickFormatter={(s) =>
                          s.length > 16 ? s.slice(0, 15) + '…' : s
                        }
                      />
                      <Bar
                        dataKey="stars"
                        fill="#c8f36b"
                        radius={[0, 4, 4, 0]}
                        barSize={22}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="stars"
                          position="right"
                          fill="#e6edf6"
                          fontSize={12}
                          formatter={(v) => fmt(Number(v))}
                        />
                      </Bar>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <Empty className="chart-empty">
                    <EmptyDescription>
                      Los repositorios seleccionados todavía no tienen
                      estrellas.
                    </EmptyDescription>
                  </Empty>
                )}
                <p className="note">
                  Top 5 de la selección · Las estrellas son una señal de
                  interés.
                </p>
              </article>
            </section>
          ) : (
            <Empty className="panel">
              <EmptyHeader>
                <EmptyTitle>
                  {data.repos.length
                    ? 'Sin coincidencias'
                    : 'Esta cuenta no tiene repositorios públicos visibles.'}
                </EmptyTitle>
                <EmptyDescription>
                  {data.repos.length
                    ? 'Prueba otro lenguaje o limpia los filtros.'
                    : 'Los repositorios privados no aparecen en este dashboard.'}
                </EmptyDescription>
              </EmptyHeader>
              {data.repos.length > 0 && (
                <Button variant="outline" onClick={reset}>
                  Limpiar filtros
                </Button>
              )}
            </Empty>
          )}
          <section className="panel repository-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">EXPLORA EL CÓDIGO</p>
                <h2>Repositorios</h2>
              </div>
              <span>
                {Math.min(limit, filtered.length)} de {filtered.length}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Lenguaje</TableHead>
                  <TableHead className="numeric">Estrellas</TableHead>
                  <TableHead className="numeric">Forks</TableHead>
                  <TableHead>Último push (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, limit).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="repo-cell">
                      <a href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.name}
                        <ArrowUpRight size={15} />
                      </a>
                      <p>{r.description || 'Sin descripción.'}</p>
                      {r.fork && <span className="badge">Fork</span>}
                      {r.archived && <span className="badge">Archivado</span>}
                    </TableCell>
                    <TableCell>{r.language}</TableCell>
                    <TableCell className="numeric">{fmt(r.stars)}</TableCell>
                    <TableCell className="numeric">{fmt(r.forks)}</TableCell>
                    <TableCell className="date-cell">
                      {r.pushedAt ? date(r.pushedAt) : 'Sin información'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!filtered.length && (
              <p className="note">
                No hay repositorios para mostrar con esta selección.
              </p>
            )}
            {filtered.length > limit && (
              <Button
                variant="outline"
                className="load-more"
                onClick={() => setLimit((n) => n + 20)}
              >
                Mostrar 20 más <ArrowDown size={16} />
              </Button>
            )}
          </section>
          <section className="panel activity-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">
                  ACTIVIDAD PÚBLICA / INDEPENDIENTE DE LOS FILTROS
                </p>
                <h2>Los últimos 14 días</h2>
              </div>
              <span>
                {data.eventsAvailable
                  ? `${eventTotal} eventos en la muestra`
                  : 'Sin información'}
              </span>
            </div>
            {data.eventsAvailable ? (
              <>
                <ChartContainer
                  config={{ count: { label: 'Eventos', color: '#72c6f0' } }}
                  className="activity-chart"
                >
                  <BarChart
                    data={days}
                    accessibilityLayer
                    margin={{ left: -20, right: 10 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => d.slice(8) + '/' + d.slice(5, 7)}
                      minTickGap={18}
                    />
                    <YAxis allowDecimals={false} />
                    <Bar
                      dataKey="count"
                      fill="#72c6f0"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </BarChart>
                </ChartContainer>
                {eventTotal === 0 && (
                  <p className="note">
                    No hay eventos de los últimos 14 días en la muestra
                    recibida. Esto no implica ausencia de trabajo.
                  </p>
                )}
                <div className="events">
                  {data.events
                    .filter((e) =>
                      days.some((d) => d.date === e.date.slice(0, 10)),
                    )
                    .slice(0, 5)
                    .map((e) => (
                      <div key={e.id}>
                        <Activity size={16} />
                        <p>
                          <strong>{eventLabel(e.type)}</strong>
                          <span>{e.repo}</span>
                        </p>
                        <time dateTime={e.date}>{date(e.date)}</time>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <Empty>
                <EmptyDescription>
                  No se pudo consultar la actividad. Los datos de repositorios
                  siguen disponibles.
                </EmptyDescription>
              </Empty>
            )}
            <p className="note">
              Hasta 100 eventos públicos recientes, agrupados por día UTC.
              GitHub puede retrasar u omitir actividad; esta gráfica no es un
              historial completo de commits.
            </p>
          </section>
        </>
      )}
      <footer>
        <span>RepoLens / Un proyecto de Saul Ramos Sanchez</span>
        <a href="/guia.html">
          Datos, alcance y documentación <ArrowUpRight size={13} />
        </a>
      </footer>
    </main>
  );
}
