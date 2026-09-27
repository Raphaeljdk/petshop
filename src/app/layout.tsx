import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { InstallProvider } from "@/components/pwa/InstallProvider";

export const metadata: Metadata = {
  title: "Matilha Prado — Pet Shop",
  description: "Pet shop completo com loja online, agendamentos e acompanhamento em tempo real. Spa Pet, banho com produtos Hydra, boutique com marcas premium.",
  keywords: ["pet shop", "matilha prado", "banho e tosa", "spa pet", "agendamento pet", "Santana São Paulo"],
  authors: [{ name: "Matilha Prado" }],
  applicationName: "Matilha Prado",
  appleWebApp: { capable: true, title: "Matilha Prado", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/matilha-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: "#102e48", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            <InstallProvider>
              {children}
              <Toaster />
            </InstallProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
