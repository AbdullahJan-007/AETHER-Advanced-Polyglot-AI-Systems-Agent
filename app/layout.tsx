import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AETHER • Advanced Polyglot AI Agent",
  description: "Hyper-intelligent full-stack systems architect. Plans deeply. Builds production-grade apps across every modern tech stack — Next.js, Flutter, Python, Go, Rust & more. Industrial strength reasoning, error handling, and modern UX.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0b0f] text-[#e6e8ec] overflow-hidden">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
