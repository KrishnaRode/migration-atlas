"use client";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";

/** Reads a Migration Atlas JSON export, imports it, then opens it in the studio. */
export function ImportButton({ onError }: { onError: (message: string | null) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    onError(null);
    setBusy(true);
    try {
      let data: unknown;
      try { data = JSON.parse(await file.text()); } catch { throw new Error(`${file.name} is not valid JSON.`); }
      const project = await api.importProject(data);
      router.push(`/studio/${project.id}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Import failed.");
      setBusy(false);
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button icon={Upload} loading={busy} onClick={() => input.current?.click()}>Import JSON</Button>
    </>
  );
}
