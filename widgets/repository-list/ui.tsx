'use client';
import { ArrowUpRight, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import type { Repo } from '@/entities/github';
const fmt = (n: number) => new Intl.NumberFormat('es-MX').format(n);
const date = (s: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(s));
export function RepositoryList({
  filtered,
  limit,
  onMore,
}: {
  filtered: Repo[];
  limit: number;
  onMore: () => void;
}) {
  return (
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
          onClick={() => onMore()}
        >
          Mostrar 20 más <ArrowDown size={16} />
        </Button>
      )}
    </section>
  );
}
