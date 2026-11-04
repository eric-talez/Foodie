import type { ReactNode } from "react";

export function StatusMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p className={`status-message${error ? " status-error" : ""}`} role={error ? "alert" : "status"}>
      {children}
    </p>
  );
}
