"use client";
import { icons, Loader2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function iconFor(name?: string | null): LucideIcon {
  if (!name) return icons.Box;
  const key = name.split("-").map((p) => (/^\d/.test(p) ? p : p[0]?.toUpperCase() + p.slice(1))).join("") as keyof typeof icons;
  return icons[key] || icons.Box;
}

export function TechIcon({ icon, color, size = 36, className, muted }: { icon?: string; color?: string; size?: number; className?: string; muted?: boolean }) {
  const Icon = iconFor(icon);
  const c = muted ? "var(--legacy)" : color || "var(--accent)";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px]", className)}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${c} 13%, transparent)`, color: c,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 22%, transparent)` }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "modern";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_14px_-4px_color-mix(in_srgb,var(--accent)_55%,transparent)]",
  secondary: "bg-surface text-text border border-border shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-surface text-bad border border-border hover:bg-surface-2",
  modern: "bg-modern text-white hover:opacity-90",
};

export function Button({ variant = "secondary", size = "md", loading, icon: Icon, children, className, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: LucideIcon }) {
  const sizes = { sm: "h-7 px-3 text-[12px] gap-1.5 rounded-full", md: "h-9 px-4 text-[13px] gap-2 rounded-full", lg: "h-12 px-6 text-[15px] gap-2 rounded-full" };
  return (
    <button
      className={cn("inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-all duration-300 ease-[var(--ease-apple)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant], sizes[size], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin" /> : Icon ? <Icon size={size === "sm" ? 13 : 15} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", icon: Icon, children, className }:
  { href: string; variant?: Variant; size?: "md" | "lg"; icon?: LucideIcon; children: ReactNode; className?: string }) {
  const sizes = { md: "h-9 px-4 text-[13px] gap-2 rounded-full", lg: "h-[52px] px-8 text-[17px] gap-2 rounded-full" };
  return (
    <Link href={href} className={cn("inline-flex items-center justify-center font-medium tracking-[-0.01em] transition-all duration-300 ease-[var(--ease-apple)] active:scale-[0.97]", VARIANTS[variant], sizes[size], className)}>
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </Link>
  );
}

export function Badge({ children, color, className, title }: { children: ReactNode; color?: string; className?: string; title?: string }) {
  const c = color || "var(--muted)";
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-[1px] text-[10.5px] font-medium leading-4 whitespace-nowrap", className)}
      style={{ color: c, background: `color-mix(in srgb, ${c} 11%, transparent)` }}>
      {children}
    </span>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("rounded-[20px] border border-border bg-surface shadow-soft", onClick && "cursor-pointer transition-all duration-500 ease-[var(--ease-apple)] hover:-translate-y-1 hover:shadow-lift", className)}>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }:
  { value: T; options: { value: T; label: string; icon?: LucideIcon }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-[10px] border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn("inline-flex items-center gap-1.5 rounded-lg font-medium transition-all",
            size === "sm" ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-[12.5px]",
            value === o.value ? "bg-surface text-text shadow-soft" : "text-muted hover:text-text")}>
          {o.icon && <o.icon size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-border bg-surface-2 px-1 font-mono text-[10px] text-muted">{children}</kbd>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-accent" />;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint", className)}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-faint"><Icon size={20} /></div>
      <div className="text-[13.5px] font-medium">{title}</div>
      {body && <div className="mt-1 max-w-xs text-[12.5px] text-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px]" style={{ borderColor: "color-mix(in srgb, var(--bad) 30%, transparent)", background: "color-mix(in srgb, var(--bad) 6%, transparent)" }}>
      <icons.CircleAlert size={15} className="mt-0.5 shrink-0 text-bad" />
      <div className="flex-1 text-text">{message}</div>
      {onRetry && <button onClick={onRetry} className="font-medium text-accent hover:underline">Retry</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 560 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 p-4 pt-[12vh] backdrop-blur-[2px] animate-fade" onMouseDown={onClose}>
      <div className="w-full animate-pop rounded-2xl border border-border bg-surface shadow-lift" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="text-[14px] font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1 text-faint hover:bg-surface-2 hover:text-text"><icons.X size={16} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
