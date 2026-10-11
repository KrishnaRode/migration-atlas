"use client";
import { ExternalLink, FileText, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { formatDate, stagger } from "@/components/catalog/primitives";
import { Badge, Button, Card, EmptyState, ErrorNote, Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { KnowledgeDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.html,.htm,.md,.markdown,.txt";
const DOC_TYPE_COLOR: Record<string, string> = { "curated-note": "var(--modern)", "official-docs": "var(--info)", "local-upload": "var(--accent)" };

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ name: string; done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);

  const handle = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    setErrors([]); setAdded([]);
    for (let i = 0; i < list.length; i++) {
      const f = list[i]!;
      setProgress({ name: f.name, done: i, total: list.length });
      if (!/\.(pdf|html?|md|markdown|txt)$/i.test(f.name)) {
        setErrors((e) => [...e, `${f.name}: unsupported type — use PDF, HTML, Markdown or TXT.`]);
        continue;
      }
      try {
        const doc = await api.upload(f);
        setAdded((a) => [...a, `${doc.title} (${doc.chunk_count} chunks)`]);
      } catch (e) {
        setErrors((x) => [...x, `${f.name}: ${(e as Error).message}`]);
      }
    }
    setProgress(null);
    onUploaded();
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files); };

  return (
    <div className="space-y-2">
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        onClick={() => !progress && input.current?.click()} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all",
          drag ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/50")}>
        {progress ? (
          <>
            <Spinner size={22} />
            <div className="mt-3 text-[13px] font-medium">Indexing {progress.name}…</div>
            <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((progress.done + 0.5) / progress.total) * 100}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-faint">{progress.done + 1} of {progress.total}</div>
          </>
        ) : (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent"><UploadCloud size={20} /></div>
            <div className="mt-3 text-[13.5px] font-medium">Drop files here or <span className="text-accent">browse</span></div>
            <div className="mt-1 text-[12px] text-muted">PDF, HTML, Markdown or TXT · up to 20 MB · indexed locally, never uploaded anywhere else</div>
          </>
        )}
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { if (e.target.files) void handle(e.target.files); e.target.value = ""; }} />
      </div>
      {added.length > 0 && <div className="animate-fade text-[12px] text-ok">Added: {added.join(", ")}</div>}
      {errors.map((m) => <ErrorNote key={m} message={m} />)}
    </div>
  );
}

export function DocumentsTab() {
  const [docs, setDocs] = useState<KnowledgeDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<KnowledgeDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.documents().then((d) => { setDocs(d); setError(null); }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const remove = async () => {
    if (!confirm) return;
    setDeleting(true); setDeleteError(null);
    try { await api.deleteDocument(confirm.id); setConfirm(null); load(); }
    catch (e) { setDeleteError((e as Error).message); } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <UploadZone onUploaded={load} />
      {error && !docs ? <ErrorNote message={error} onRetry={load} /> : !docs ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-16 rounded-xl" />)}</div>
      ) : docs.length === 0 ? (
        <Card><EmptyState icon={FileText} title="No documents yet" body="Upload files above or ingest an enabled official source." /></Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          <div className="flex items-center justify-between bg-surface-2/50 px-4 py-2.5 text-[12px] text-muted">
            <span>{docs.length} documents · {docs.reduce((n, d) => n + d.chunk_count, 0)} chunks</span>
          </div>
          {docs.map((d, i) => (
            <div key={d.id} style={stagger(i, 20, 400)} className="group flex animate-fade items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40">
              <FileText size={16} className="mt-0.5 shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-medium">{d.title}</span>
                  <Badge color={DOC_TYPE_COLOR[d.doc_type] ?? "var(--muted)"}>{d.doc_type}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
                  <span className="font-medium text-muted">{d.vendor}{d.product ? ` · ${d.product}` : ""}</span>
                  <span>{d.chunk_count} chunks</span>
                  <span>Retrieved {formatDate(d.retrieved_at)}</span>
                  {/^https?:/.test(d.url) && (
                    <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[320px] items-center gap-1 truncate font-mono hover:text-accent">{d.url}<ExternalLink size={10} className="shrink-0" /></a>
                  )}
                </div>
                {d.technologies.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">{d.technologies.map((t) => <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">{t}</span>)}</div>
                )}
              </div>
              <button onClick={() => { setDeleteError(null); setConfirm(d); }} title="Delete document"
                className="rounded-lg p-1.5 text-faint opacity-60 transition-all hover:bg-surface-2 hover:text-bad group-hover:opacity-100"><Trash2 size={14} /></button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={!!confirm} onClose={() => !deleting && setConfirm(null)} title="Delete document?" width={460}>
        <p className="text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-text">{confirm?.title}</span> and its {confirm?.chunk_count} indexed chunks will be removed from the local knowledge base. The knowledge graph is rebuilt afterwards.
        </p>
        {deleteError && <div className="mt-3"><ErrorNote message={deleteError} /></div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" icon={Trash2} loading={deleting} onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
