import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "praxisAI — פלטפורמת AI קלינית",
  description: "ניהול קליניקת פיזיותרפיה עם AI: תיעוד, מטופלים ומסמכים",
  icons: { icon: "/logo.svg", shortcut: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
