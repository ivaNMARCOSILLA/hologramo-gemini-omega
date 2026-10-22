import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./omega-a11y.css";
import "./omega-futurista.css";
import "./omega-central-jump.css";
import OmegaA11yRoot from "../components/OmegaA11yRoot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OMEGA · Holograma controlado por voz",
  description: "Centro de mando holográfico OMEGA, accesible por voz, texto y gestos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<OmegaA11yRoot /></body>
    </html>
  );
}
