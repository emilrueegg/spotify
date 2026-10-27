import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const condensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reihe",
  description: "Lieblingssongs und eigene Playlists prüfen, dann erst nach Bestätigung herausnehmen.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${barlow.variable} ${condensed.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f7f7f5] text-[#121212]">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
