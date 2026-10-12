import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "./globals.css";

const assistant = Assistant({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-assistant", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Heritg",
  description: "Arsip keluarga pribadi. Bikin silsilah dari siapa aja, simpan, dan bagikan kalau kamu mau.",
  alternates: { canonical: "/" },
  openGraph: { title: "Heritg", description: "Arsip keluarga pribadi", type: "website" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className={assistant.variable}><body><AuthProvider>{children}</AuthProvider></body></html>;
}
