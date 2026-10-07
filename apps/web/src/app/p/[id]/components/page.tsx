"use client";

import { ComponentsCatalog } from "@/components/components-page";
import { ProjectPage } from "@/components/project-parts";

export default function Page() {
  return <ProjectPage active="components">{(p) => <ComponentsCatalog project={p} />}</ProjectPage>;
}
