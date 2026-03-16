import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SantIA - Votre assistant sante intelligent",
  description:
    "Assistant medical IA pour vous aider a mieux gerer votre sante au quotidien. Ne remplace pas une consultation medicale.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
