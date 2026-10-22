import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#FF7700",
};

export const metadata: Metadata = {
  title: "DFurn ERP System",
  description: "DFurn Modular Systems ERP",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "D'furn ERP",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased bg-[#f5f6f8] text-slate-800" style={{ colorScheme: 'light' }}>
      <body className="h-full bg-[#f5f6f8] text-slate-800 font-sans overflow-x-hidden antialiased">
        <ServiceWorkerRegister />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
