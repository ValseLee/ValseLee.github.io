import type { Metadata } from "next";
import { Cormorant, Figtree } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const cormorant = Cormorant({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Thoughts",
  description: "개인 미니 블로그",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${cormorant.variable} ${figtree.variable} antialiased`}
        style={{
          fontFamily: "var(--font-figtree), sans-serif",
        }}
      >
        <div className="min-h-screen max-w-3xl mx-auto px-6">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
