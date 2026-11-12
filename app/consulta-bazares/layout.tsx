
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Directorio de Bazares",
  description:
    "Descubre los bazares registrados en VIPACK Envíos. Encuentra tus favoritos y visita sus perfiles de Facebook.",

  alternates: {
    canonical: "/consulta-bazares",
  },

  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://vipack-envios.com/consulta-bazares",
    siteName: "VIPACK Envíos",
    title: "Directorio de Bazares | VIPACK Envíos",
    description:
      "Descubre los bazares registrados en VIPACK Envíos. Encuentra tus favoritos y visita sus perfiles de Facebook.",
    images: [
      {
        url: "https://vipack-envios.com/banner-bazares-nuevo.png",
        alt: "Directorio de Bazares VIPACK Envíos",
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Directorio de Bazares | VIPACK Envíos",
    description:
      "Encuentra bazares registrados en VIPACK y visita sus perfiles de Facebook.",
    images: [
      "https://vipack-envios.com/banner-bazares-nuevo.png",
    ],
  },
};

export default function ConsultaBazaresLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
