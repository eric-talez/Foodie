"use client";

import { useContext } from "react";
import { RuntimeModeContext } from "../lib/RuntimeModeContext";

export function SiteFooter() {
  const mode = useContext(RuntimeModeContext);
  return <footer className="site-footer container">
    <p>Santa Clara &amp; San Jose</p>
    <p>Ordering is not live yet.{mode === "DEMO" && " Sample locations and menus only."}</p>
  </footer>;
}
