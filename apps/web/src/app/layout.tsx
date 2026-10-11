import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Migration Atlas — local AI migration architecture studio",
  description: "Explore, design, compare and validate legacy-to-cloud modernization architectures using local AI.",
  icons: { icon: "/favicon.svg" },
};

// Applies the saved theme before paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('atlas-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
