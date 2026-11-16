import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./work.css";
import AuthGate from "@/components/Auth";

export const metadata: Metadata = {
  title: "Falcão SH - Work",
  description: "Licitações, documentos e orçamentos da Falcão SH Construções",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0a0a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><AuthGate>{children}</AuthGate></body></html>;
}
