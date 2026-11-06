"use client";

import Link from "next/link";
import { useContext } from "react";
import { RuntimeModeContext } from "../lib/RuntimeModeContext";

export function SiteHeader() {
  const mode = useContext(RuntimeModeContext);
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header container">
        <Link className="wordmark" href="/" aria-label="Foodie home">Foodie<span aria-hidden="true">.</span></Link>
        {mode === "DEMO" && <span className="demo-badge">Demo</span>}
      </header>
    </>
  );
}
