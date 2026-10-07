"use client";

import { useEffect, useState } from "react";

const key = (id: string) => `craftr:tier:${id}`;

/** Which manufacturing option the user picked for a project, kept across the BOM → checkout pages. */
export function useTier(projectId: string) {
  const [tier, setTier] = useState("prototype");
  useEffect(() => {
    try {
      setTier(sessionStorage.getItem(key(projectId)) ?? "prototype");
    } catch {}
  }, [projectId]);
  return [
    tier,
    (t: string) => {
      setTier(t);
      try {
        sessionStorage.setItem(key(projectId), t);
      } catch {}
    },
  ] as const;
}
