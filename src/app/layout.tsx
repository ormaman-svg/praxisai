import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import { LANG_COOKIE } from "@/lib/i18n/translations";

export const metadata: Metadata = {
  title: "praxisAI — פלטפורמת AI קלינית",
  description: "ניהול קליניקת פיזיותרפיה עם AI: תיעוד, מטופלים ומסמכים",
  icons: { icon: "/logo.svg", shortcut: "/logo.svg" },
};

const langInitScript = `(function(){
  try {
    var RTL = {he:1,ar:1};
    var l = localStorage.getItem('${LANG_COOKIE}') || 'he';
    document.documentElement.lang = l;
    document.documentElement.dir = RTL[l] ? 'rtl' : 'ltr';
  } catch(e){}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: langInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
