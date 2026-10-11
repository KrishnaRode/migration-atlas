"use client";
// Cached ontology reads shared by every screen.
import { useEffect, useState } from "react";
import { api } from "./api";
import type { Category, TechCard } from "./types";

let techPromise: Promise<TechCard[]> | null = null;
let catPromise: Promise<Category[]> | null = null;

export function loadTechnologies(): Promise<TechCard[]> {
  if (!techPromise) techPromise = api.technologies().catch((e) => { techPromise = null; throw e; });
  return techPromise;
}
export function loadCategories(): Promise<Category[]> {
  if (!catPromise) catPromise = api.categories().catch((e) => { catPromise = null; throw e; });
  return catPromise;
}

export function useOntology() {
  const [techs, setTechs] = useState<TechCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([loadTechnologies(), loadCategories()])
      .then(([t, c]) => { if (alive) { setTechs(t); setCategories(c); } })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);
  const byId = (id: string) => techs.find((t) => t.id === id);
  return { techs, categories, byId, error, loaded: techs.length > 0 };
}
