"use client";

import { createContext, type ReactNode } from "react";
import type { RuntimeMode } from "./runtime";

export const RuntimeModeContext = createContext<RuntimeMode>("DEMO");

export function RuntimeModeProvider({ mode, children }: { mode: RuntimeMode; children: ReactNode }) {
  return <RuntimeModeContext.Provider value={mode}>{children}</RuntimeModeContext.Provider>;
}
