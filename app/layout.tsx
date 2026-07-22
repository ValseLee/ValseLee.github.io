import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import site from "@/content/site";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: site.identity.titleText,
  description: site.identity.intro,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${figtree.variable} antialiased`}>
        <div className="site-shell">
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
