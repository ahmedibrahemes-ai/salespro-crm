import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Venom CRM — منصة المبيعات",
  description: "منصة متكاملة لإدارة المبيعات والتسويق مدعومة بالذكاء الاصطناعي",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body
        className={`${cairo.variable} font-sans antialiased bg-[#0a0d14] text-[#f0f2ff]`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
