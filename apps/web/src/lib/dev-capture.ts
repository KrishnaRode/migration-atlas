"use client";
// Development-only helper used to capture the README screenshots from the running app.
import { toPng } from "html-to-image";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __atlasCapture: typeof toPng }).__atlasCapture = toPng;
}
