import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

// GON typography stack — Space Grotesk (display) + Inter (text) + JetBrains Mono (mono).
// Estos nombres coinciden con --gon-font-display / -text / -mono en brand-tokens.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: 'GONOVI · Hub Oficial',
  description: 'Hub oficial de GONOVI: indicadores, Trading Lab, auditoría Montecarlo, educación y comunidad.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'GONOVI · Hub Oficial',
    description: 'Indicadores, educación interactiva y ecosistema de trading visual para la comunidad GONOVI.',
    url: 'https://gonovi.app',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GONOVI · Hub Oficial',
    description: 'Indicadores con Pine Script, Trading Lab, auditoría Montecarlo y comunidad GONOVI.',
    images: ['/og-card.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GONOVI',
  },
};

export const viewport: Viewport = {
  themeColor: "#11162A", // GON v2 Ink Deep — navy app shell
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <head />
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
