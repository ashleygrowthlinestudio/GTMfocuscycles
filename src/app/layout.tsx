import type { Metadata } from "next";
import "./globals.css";
import { GTMPlanProvider } from "@/context/GTMPlanContext";

export const metadata: Metadata = {
  title: "GTM Focus Cycle",
  description: "Interactive revenue planning and strategic bets calculator for GTM teams",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 font-sans">
        <GTMPlanProvider>{children}</GTMPlanProvider>
      </body>
    </html>
  );
}

