"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-24">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
