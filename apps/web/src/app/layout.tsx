import type { ReactNode } from "react";
import type { Metadata } from "next";
import { CartProvider } from "../features/cart/CartProvider";
import { RuntimeModeProvider } from "../lib/RuntimeModeContext";
import { getRuntime } from "../lib/runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foodie — Local food, fairer delivery",
  description: "Explore Foodie's transparent, lower fees and fair pay for drivers in Santa Clara and San Jose.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { mode } = await getRuntime();
  return (
    <html lang="en">
      <body><RuntimeModeProvider mode={mode}><CartProvider>{children}</CartProvider></RuntimeModeProvider></body>
    </html>
  );
}
