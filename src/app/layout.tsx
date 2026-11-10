import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eric Terminal | Market Intelligence",
  description: "Eric Terminal — private institutional, insider, and FDA market intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
