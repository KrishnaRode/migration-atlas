"use client";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CategoryChips } from "@/components/catalog/category-chips";
import { TechTile, TileGridSkeleton } from "@/components/catalog/primitives";
import { SearchResults, type SearchResult } from "@/components/catalog/search-results";
import { PageShell } from "@/components/shell";
import { EmptyState, ErrorNote, Kbd, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { loadCategories, loadTechnologies } from "@/lib/ontology";
import type { Category, TechCard } from "@/lib/types";

const EXAMPLES = ["Oracle to Databricks", "Informatica", "Teradata to BigQuery", "Kafka", "Mainframe CDC"];

function Catalogue() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<string | null>(null);
  const [techs, setTechs] = useState<TechCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadCatalogue = useCallback(() => {
    setLoadError(null);
    Promise.all([loadTechnologies(), loadCategories()])
      .then(([t, c]) => { setTechs(t); setCategories(c); })
      .catch((e: Error) => setLoadError(e.message));
  }, []);
  useEffect(loadCatalogue, [loadCatalogue]);

  // "/" focuses the search box, like most catalogues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim();
  useEffect(() => {
    if (!q) { setResult(null); setSearchError(null); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      router.replace(`${pathname}?q=${encodeURIComponent(q)}`, { scroll: false });
      api.search(q)
        .then((r) => { if (alive) { setResult(r); setSearchError(null); } })
        .catch((e: Error) => alive && setSearchError(e.message))
        .finally(() => alive && setSearching(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, nonce, pathname, router]);

  const clear = () => {
    setQuery("");
    router.replace(pathname, { scroll: false });
    inputRef.current?.focus();
  };

  const visible = useMemo(() => (category ? techs.filter((t) => t.category === category) : techs), [techs, category]);
  const byId = useCallback((id: string) => techs.find((t) => t.id === id), [techs]);
  const catOf = (id: string) => categories.find((c) => c.id === id);

  return (
    <div>
      <div className="mx-auto max-w-3xl animate-rise pb-8 pt-4 text-center">
        <h1 className="text-[30px] font-semibold tracking-[-0.025em]">Technology catalogue</h1>
        <p className="mt-2 text-[14px] text-muted">
          {techs.length ? `${techs.length} technologies` : "Technologies"} across legacy and modern estates — with migration mappings, patterns, risks and local documentation.
        </p>
        <div className="group relative mt-6">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint transition-colors group-focus-within:text-accent" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
            onKeyDown={(e) => e.key === "Escape" && clear()}
            placeholder="Search technologies, or try 'Oracle to Databricks'"
            className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-24 text-[15px] shadow-soft outline-none transition-all placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)]" />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {searching && <Spinner size={15} />}
            {query ? (
              <button onClick={clear} title="Clear search" className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-text"><X size={15} /></button>
            ) : <Kbd>/</Kbd>}
          </div>
        </div>
        {!q && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[12px] text-faint">
            Try
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setQuery(ex)} className="rounded-md px-1.5 font-medium text-muted underline-offset-2 hover:text-accent hover:underline">{ex}</button>
            ))}
          </div>
        )}
      </div>

      {q ? (
        searchError ? (
          <div className="mx-auto max-w-xl"><ErrorNote message={searchError} onRetry={() => setNonce((n) => n + 1)} /></div>
        ) : result ? (
          <div className={searching ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <SearchResults result={result} categories={categories} byId={byId} />
          </div>
        ) : <TileGridSkeleton count={8} />
      ) : loadError ? (
        <div className="mx-auto max-w-xl"><ErrorNote message={loadError} onRetry={loadCatalogue} /></div>
      ) : !techs.length ? (
        <TileGridSkeleton />
      ) : (
        <>
          <div className="mb-6 animate-fade">
            <CategoryChips categories={categories} value={category} onChange={setCategory} total={techs.length} />
          </div>
          {visible.length ? (
            <div key={category ?? "all"} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((t, i) => <TechTile key={t.id} tech={t} category={catOf(t.category)} index={i} />)}
            </div>
          ) : (
            <EmptyState icon={Search} title="No technologies in this category" />
          )}
        </>
      )}
    </div>
  );
}

export default function TechnologiesPage() {
  return (
    <PageShell>
      <Suspense fallback={<TileGridSkeleton />}>
        <Catalogue />
      </Suspense>
    </PageShell>
  );
}
