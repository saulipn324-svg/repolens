'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadDashboard,
  username,
  GitHubError,
  type Dashboard,
} from '../../entities/github/index.ts';
export function useExploreAccount() {
  const [searchRevision, setSearchRevision] = useState(0);
  const [input, setInput] = useState(''),
    [data, setData] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<GitHubError | null>(null);
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
    setSearchRevision((n) => n + 1);
    const controller = new AbortController();
    active.current = controller;
    const id = ++sequence.current;
    setInput(name);
    setLoading(true);
    setError(null);
    setData(null);
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
  const cancel = () => {
    active.current?.abort();
    sequence.current++;
    setLoading(false);
  };
  return {
    input,
    setInput,
    data,
    loading,
    error,
    search,
    cancel,
    searchRevision,
  };
}
