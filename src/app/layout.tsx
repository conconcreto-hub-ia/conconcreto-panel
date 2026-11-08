import type { Metadata } from "next";
import { Montserrat, Work_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Panel de apps · Conconcreto",
  description: "Las apps que Conconcreto construye en Think AI: quién entra a cada una y cómo van.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${montserrat.variable} ${workSans.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
