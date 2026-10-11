"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Studio } from "@/components/studio/Studio";

function StudioRoute() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  return <Studio projectId={id} autoGenerate={search.get("generate") === "1"} useAi={search.get("ai") !== "0"} initialView={search.get("view")} />;
}

export default function Page() {
  return (
    <Suspense>
      <StudioRoute />
    </Suspense>
  );
}
