import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "משק רוזנברג · הזמנות",
  description: "מנגו, אבוקדו, עגבניות שרי ושמן זית ממשק רוזנברג במושב שדה ניצן. הזמנה מראש לנקודות חלוקה ומשלוחים.",
  icons: { icon: "/logo.webp" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&family=Rubik:wght@600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
