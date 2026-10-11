"use client";
// Canvas image export (PNG/SVG) — captures the React Flow viewport framed to all nodes.
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export async function captureCanvas(nodes: Node[], format: "png" | "svg" = "png", width = 2000): Promise<string> {
  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el || !nodes.length) throw new Error("Open the canvas view with at least one component to export the diagram.");
  const bounds = getNodesBounds(nodes);
  const pad = 80;
  const aspect = (bounds.height + pad * 2) / (bounds.width + pad * 2);
  const height = Math.max(600, Math.round(width * aspect));
  const vp = getViewportForBounds(bounds, width, height, 0.2, 2, 0.08);
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim() || "#f4f6fa";
  const opts = {
    backgroundColor: bg,
    width,
    height,
    pixelRatio: format === "png" ? 1.5 : 1,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
    filter: (n: HTMLElement) => !n.classList?.contains("react-flow__node-toolbar"),
  };
  return format === "png" ? toPng(el, opts) : toSvg(el, opts);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] || "application/octet-stream";
  if (head.includes(";base64")) {
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

