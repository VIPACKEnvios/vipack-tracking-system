import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vipack-envios.com"),

  title: {
    default: "VIPACK Envíos",
    template: "%s | VIPACK Envíos",
  },

  description:
    "VIPACK Envíos: recolección de compras en Tijuana, inventario en línea, almacenamiento, seguimiento y envíos nacionales.",

  keywords: [
    "VIPACK",
    "VIPACK Envíos",
    "Envíos nacionales",
    "Recolecciones en Tijuana",
    "Inventario en línea",
    "Almacenamiento",
    "Seguimiento de envíos",
    "Logística",
    "Paquetería",
    "Tijuana",
  ],

  authors: [
    {
      name: "VIPACK Envíos",
    },
  ],

  creator: "VIPACK Envíos",
  publisher: "VIPACK Envíos",

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://vipack-envios.com",
    siteName: "VIPACK Envíos",

    title: "VIPACK Envíos",

    description:
      "Recolección de compras en Tijuana, inventario en línea, almacenamiento, seguimiento y envíos nacionales con VIPACK Envíos.",

    images: [
      {
        url: "https://vipack-envios.com/og-vipack.jpg?v=2",
        width: 1200,
        height: 630,
        alt: "VIPACK Envíos",
        type: "image/jpeg",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: "VIPACK Envíos",

    description:
      "Recolección de compras en Tijuana, inventario en línea y envíos nacionales con VIPACK Envíos.",

    images: [
      "https://vipack-envios.com/og-vipack.jpg?v=2",
    ],
  },

  icons: {
    icon: "/vipack-logo.jpg",
    shortcut: "/vipack-logo.jpg",
    apple: "/vipack-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}