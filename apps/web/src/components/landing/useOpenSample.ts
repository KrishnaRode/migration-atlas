"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

/** Creates a project from a bundled sample estate and opens it in the studio with generation queued. */
export function useOpenSample() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (sampleId: string) => {
    if (pending) return;
    setPending(sampleId);
    setError(null);
    try {
      const project = await api.fromSample(sampleId);
      router.push(`/studio/${project.id}?generate=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the sample estate.");
      setPending(null);
    }
  };

  return { open, pending, error, clearError: () => setError(null) };
}
