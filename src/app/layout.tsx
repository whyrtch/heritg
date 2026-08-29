import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heritg — A private family archive",
  description: "Create and preserve your family tree privately on this device.",
  openGraph: { title: "Heritg", description: "A private family archive", type: "website" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
