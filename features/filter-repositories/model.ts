'use client';
import { useEffect, useMemo, useState } from 'react';
import { filterRepos, type Repo } from '../../entities/github/index.ts';
export function useRepositoryFilters(repos: Repo[]) {
  const [query, setQuery] = useState(''),
    [language, setLanguage] = useState('all'),
    [sort, setSort] = useState('stars'),
    [forks, setForks] = useState(true),
    [archived, setArchived] = useState(true),
    [limit, setLimit] = useState(20);
  useEffect(() => setLimit(20), [query, language, sort, forks, archived]);
  const filtered = useMemo(
    () => filterRepos(repos, query, language, forks, archived, sort),
    [repos, query, language, forks, archived, sort],
  );
  const reset = () => {
    setQuery('');
    setLanguage('all');
    setSort('stars');
    setForks(true);
    setArchived(true);
  };
  return {
    query,
    setQuery,
    language,
    setLanguage,
    sort,
    setSort,
    forks,
    setForks,
    archived,
    setArchived,
    limit,
    setLimit,
    filtered,
    reset,
  };
}
