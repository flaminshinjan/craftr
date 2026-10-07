"use client";

import { ComponentsCatalog } from "@/components/components-page";
import { Shell } from "@/components/shell";

export default function Page() {
  return (
    <Shell active="components">
      <ComponentsCatalog />
    </Shell>
  );
}
