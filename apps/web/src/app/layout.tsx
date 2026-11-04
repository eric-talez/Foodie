import type { ReactNode } from "react";
import type { Metadata } from "next";
import { CartProvider } from "../features/cart/CartProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foodie — Local food, fairer delivery",
  description: "Explore Foodie's customer demo: transparent, lower fees and fair pay for drivers in Santa Clara and San Jose.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
