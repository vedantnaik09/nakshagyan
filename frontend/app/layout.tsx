import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';


if (typeof window !== 'undefined') {
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.3,
  });
}


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NakshaGyan",
  description: "Interactive semantic segmentation on WMS service images",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.jpg" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}