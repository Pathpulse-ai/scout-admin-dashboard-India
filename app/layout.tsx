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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var theme = saved || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
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
