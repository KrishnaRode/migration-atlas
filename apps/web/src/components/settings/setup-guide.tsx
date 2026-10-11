"use client";
import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui";

export function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked; the command stays selectable */ }
  };
  return (
    <div className="group mt-2 flex items-center gap-2 rounded-xl border border-border bg-surface-2 py-2 pl-3 pr-1.5 font-mono text-[12.5px]">
      <span className="select-none text-faint">$</span>
      <code className="flex-1 select-all overflow-x-auto whitespace-nowrap text-text">{command}</code>
      <button onClick={copy} title="Copy command"
        className="flex h-7 items-center gap-1 rounded-lg px-2 font-sans text-[11.5px] font-medium text-muted transition-colors hover:bg-surface hover:text-text">
        {copied ? <><Check size={12} className="text-ok" /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </div>
  );
}

/** Turns backend setup strings ("Start it: ollama serve") into prose + copyable commands. */
function parseStep(step: string): { text: string; command?: string; note?: string; link?: string } {
  const url = /(https?:\/\/\S+)/.exec(step)?.[1];
  const idx = step.indexOf(": ");
  if (idx > 0) {
    const rest = step.slice(idx + 2).trim();
    if (/^ollama\s/.test(rest)) {
      const [command, ...note] = rest.split(/\s{2,}/);
      return { text: step.slice(0, idx), command: command?.trim(), note: note.join(" ").trim() || undefined };
    }
  }
  return { text: url ? step.replace(url, "").trim() : step, link: url };
}

export function SetupGuide({ steps }: { steps: string[] }) {
  const parsed = steps.length ? steps.map(parseStep) : [
    { text: "Start it", command: "ollama serve" }, { text: "Pull a model", command: "ollama pull qwen3:4b" },
  ];
  return (
    <Card className="animate-rise p-6">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent"><Terminal size={15} /></div>
        <div>
          <div className="text-[14px] font-semibold">Set up local AI in a couple of minutes</div>
          <div className="text-[12px] text-muted">Migration Atlas works without AI — rules, ontology and validation all run locally — but Ollama unlocks the copilot and narratives.</div>
        </div>
      </div>
      <ol className="mt-5 space-y-4">
        {parsed.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] font-semibold text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-[13px] font-medium">
                {s.text}
                {s.link && <> <a href={s.link} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.link.replace(/^https?:\/\//, "")}</a></>}
              </div>
              {s.command && <CommandBlock command={s.command} />}
              {s.note && <div className="mt-1 text-[11.5px] text-faint">{s.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
