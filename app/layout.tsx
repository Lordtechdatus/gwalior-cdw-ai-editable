import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nirmal Gwalior | C&D Waste Intelligence",
  description:
    "AI-enabled construction and demolition waste reporting, collection tracking, recycling verification, and city compliance monitoring.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
