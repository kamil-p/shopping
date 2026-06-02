import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const fontSans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fontHeading = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zakupy",
  description: "Wewnętrzna aplikacja do zakupów",
  applicationName: "Zakupy",
  // Full-screen standalone behavior on iOS (emits apple-mobile-web-app-* tags).
  appleWebApp: {
    capable: true,
    title: "Zakupy",
    statusBarStyle: "default",
  },
  // iOS uses apple-touch-icon, not the manifest icons.
  icons: {
    apple: "/icons/apple-icon.png",
  },
};

export const viewport: Viewport = {
  // Blend the mobile browser chrome with the page background per theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f110e" },
  ],
  // Draw under the iPhone notch / safe areas when running standalone.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontHeading.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
