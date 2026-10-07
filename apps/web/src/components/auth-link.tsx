"use client";

import { useClerk } from "@clerk/nextjs";
import { useCallback } from "react";

type Mode = "sign-in" | "sign-up";

/** Opens Clerk's sign-in or sign-up as a modal over the current page, and comes back to the same page afterwards. */
export function useAuthModal() {
  const clerk = useClerk();
  return useCallback(
    (mode: Mode) => {
      // Until Clerk has loaded there is no modal to open, so fall back to the full page.
      if (!clerk.loaded) return void (location.href = `/${mode}`);
      const back = { forceRedirectUrl: location.pathname + location.search, signInForceRedirectUrl: location.pathname + location.search, signUpForceRedirectUrl: location.pathname + location.search };
      if (mode === "sign-in") clerk.openSignIn(back);
      else clerk.openSignUp(back);
    },
    [clerk],
  );
}

/** A link to sign in or sign up that opens the modal. It is still a real link, so it works before scripts load. */
export function AuthLink({ mode, onClick, children, ...rest }: { mode: Mode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const open = useAuthModal();
  return (
    <a
      {...rest}
      href={`/${mode}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        open(mode);
      }}
    >
      {children}
    </a>
  );
}
