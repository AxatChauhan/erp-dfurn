import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DFurn ERP System",
  description: "DFurn Modular Systems ERP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased bg-[#f5f6f8] text-slate-800" style={{ colorScheme: 'light' }}>
      <body className="h-full flex bg-[#f5f6f8] text-slate-800 font-sans overflow-hidden">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
