import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/providers/AuthProvider";

export const metadata: Metadata = {
  title: "Matilha Prado — Pet Shop",
  description: "Pet shop completo com loja online, agendamentos e acompanhamento em tempo real. Spa Pet, banho com produtos Hydra, boutique com marcas premium.",
  keywords: ["pet shop", "matilha prado", "banho e tosa", "spa pet", "agendamento pet", "Santana São Paulo"],
  authors: [{ name: "Matilha Prado" }],
  icons: {
    icon: "/images/logo-matilha-prado-512.png",
    apple: "/images/logo-matilha-prado-1024.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
