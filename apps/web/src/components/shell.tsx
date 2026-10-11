"use client";
import { Moon, Sun, Cpu, CircleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import "@/lib/dev-capture";
import { cn } from "@/lib/utils";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="url(#lg)" />
      <path d="M8 21.5 L14 11 L19 17.5 L24.5 9.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
      <circle cx="8" cy="21.5" r="2.4" fill="white" />
      <circle cx="14" cy="11" r="2.4" fill="white" />
      <circle cx="19" cy="17.5" r="2.4" fill="white" />
      <circle cx="24.5" cy="9.5" r="2.4" fill="#7CF3DF" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2F6BFF" />
          <stop offset="1" stopColor="#0FA68F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("atlas-theme", next ? "dark" : "light"); } catch { /* private mode */ }
    setDark(next);
  };
  return { dark, toggle };
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle} title="Toggle theme" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text">
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

/** "Local AI" indicator — green when Ollama answers, amber with a setup hint otherwise. */
export function LocalAIBadge({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<{ ok: boolean; model: string | null; message: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.health().then((h) => alive && setState({ ok: h.ai.reachable && !!h.ai.model, model: h.ai.model, message: h.ai.message }))
      .catch(() => alive && setState({ ok: false, model: null, message: "Backend not reachable" }));
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const ok = state?.ok;
  return (
    <Link href="/settings" title={state ? `${state.message} Architecture data stays on this machine.` : "Checking local AI…"}
      className="group inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-muted transition-colors hover:text-text">
      <span className="relative flex h-2 w-2">
        {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-50" />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", state == null ? "bg-faint" : ok ? "bg-ok" : "bg-warn")} />
      </span>
      {ok ? <Cpu size={13} /> : state ? <CircleAlert size={13} /> : null}
      <span>Local AI</span>
      {!compact && state?.model && <span className="font-mono text-[11px] text-faint group-hover:text-muted">{state.model}</span>}
      {!compact && state && !ok && <span className="text-warn">· setup</span>}
    </Link>
  );
}

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/technologies", label: "Technologies" },
  { href: "/patterns", label: "Patterns" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/settings", label: "Settings" },
];

export function TopNav({ transparent }: { transparent?: boolean }) {
  const path = usePathname();
  return (
    <header className={cn("sticky top-0 z-40 border-b", transparent ? "border-transparent bg-bg/60" : "border-border bg-bg/80", "backdrop-blur-xl")}>
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Migration Atlas</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn("rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                path?.startsWith(n.href) ? "text-text" : "text-muted hover:text-text")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LocalAIBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-2 px-6 py-6 text-[12px] text-faint sm:flex-row sm:items-center">
        <div className="flex items-center gap-2"><Logo size={18} /> Migration Atlas · Architecture data stays local by default.</div>
        <div>The Sunday Builds #14 · Built to explore what local AI can do.</div>
      </div>
    </footer>
  );
}

export function PageShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className={cn("mx-auto w-full flex-1 px-6 py-8", wide ? "max-w-[1440px]" : "max-w-[1280px]")}>{children}</main>
      <Footer />
    </div>
  );
}
