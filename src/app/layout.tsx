import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Intelligence | Terminal",
  description: "Private 13F, FDA 510(k), and Form 4 research dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
