"use client";

import { usePathname } from "next/navigation";

/**
 * The signed-in app's header, main area and footer. The home page (/) is a public landing page
 * with its own header, main and footer, so it gets the page as it is.
 */
export function AppFrame({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  if (usePathname() === "/") return <>{children}</>;
  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  );
}
