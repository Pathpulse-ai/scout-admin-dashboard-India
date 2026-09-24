import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import MainLayout from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "PathPulse Admin | Detection Dashboard",
  description: "Secure access to detection analytics and investigator records",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // The admin console ships as a light-only surface, so any
                // previously stored 'dark' preference is cleared on boot.
                try {
                  localStorage.setItem('theme', 'light');
                } catch (e) {}
                document.documentElement.setAttribute('data-theme', 'light');
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <ThemeProvider>
          <SidebarProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
