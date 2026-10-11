"use client";
import { Database, FileText, GitFork, Lock, Search, ShieldCheck, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { DocumentsTab } from "@/components/knowledge/documents-tab";
import { GraphTab } from "@/components/knowledge/graph-tab";
import { SearchTab } from "@/components/knowledge/search-tab";
import { SourcesTab } from "@/components/knowledge/sources-tab";
import { PageShell } from "@/components/shell";
import { Segmented } from "@/components/ui";

type Tab = "search" | "sources" | "documents" | "graph";
const TABS: { value: Tab; label: string; icon: typeof Search }[] = [
  { value: "search", label: "Search", icon: Search },
  { value: "sources", label: "Sources", icon: Database },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "graph", label: "Graph", icon: GitFork },
];

const PRINCIPLES = [
  { icon: Lock, title: "Local RAG", body: "Retrieval runs over documents indexed on this machine." },
  { icon: ShieldCheck, title: "Registered sources only", body: "Only explicitly registered, enabled sources can be fetched." },
  { icon: Timer, title: "Polite fetching", body: "robots.txt, rate limits and allowed URL prefixes are respected." },
];

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("search");

  // Remember the tab in the hash so links like /knowledge#sources work.
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.value === h)) setTab(h);
  }, []);
  const change = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  return (
    <PageShell>
      <div className="mb-8 animate-rise">
        <h1 className="text-[30px] font-semibold tracking-[-0.025em]">Knowledge base</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-muted">
          Retrieval-augmented answers grounded in your local documents and curated notes. Nothing leaves the machine except
          fetching official documentation from sources you have enabled.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-modern-soft text-modern"><p.icon size={15} /></div>
              <div>
                <div className="text-[12.5px] font-semibold">{p.title}</div>
                <div className="text-[12px] leading-snug text-muted">{p.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6"><Segmented value={tab} options={TABS} onChange={change} /></div>

      <div key={tab} className="animate-fade">
        {tab === "search" && <SearchTab />}
        {tab === "sources" && <SourcesTab />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "graph" && <GraphTab />}
      </div>
    </PageShell>
  );
}
