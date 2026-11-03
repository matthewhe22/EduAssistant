"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { STILL_TICK, TICKS, TICK_MS } from "@/lib/ui/landing-anim";

const ClockContext = createContext<number>(STILL_TICK);

/**
 * One clock for every animated demo on the page. It starts at the finished state, which is what
 * the server renders and what visitors who prefer reduced motion keep. Otherwise it loops, and
 * pauses while the tab is hidden.
 */
export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState(STILL_TICK);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setT(0);
    const id = window.setInterval(() => {
      if (!document.hidden) setT((x) => (x + 1) % TICKS);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return <ClockContext.Provider value={t}>{children}</ClockContext.Provider>;
}

export const useTick = () => useContext(ClockContext);
