import { Geist_Mono, Hanken_Grotesk, Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});
const ui = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken-grotesk" });
const data = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${ui.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}
