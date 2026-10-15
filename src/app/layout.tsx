import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--yas-font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--yas-font-montserrat",
});

export const metadata: Metadata = {
  title: "Yas English Lab",
  description: "Yas English Lab learning platform",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
