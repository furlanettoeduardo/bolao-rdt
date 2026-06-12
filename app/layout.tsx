import type { Metadata, Viewport } from "next";
import { auth } from "@/auth";
import { Header } from "@/components/nav/header";
import { MobileNav } from "@/components/nav/mobile-nav";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Bolão da Copa do Mundo FIFA 2026 em Urussanga — registre seus palpites, acompanhe os placares quase em tempo real e dispute o ranking da cidade.",
};

export const viewport: Viewport = {
  themeColor: "#133f30",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-10">
          {children}
        </main>
        <footer className="hidden border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400 md:block">
          {APP_NAME} · Copa do Mundo FIFA 2026 · dados via Football-Data.org
        </footer>
        {session?.user ? <MobileNav /> : null}
      </body>
    </html>
  );
}
