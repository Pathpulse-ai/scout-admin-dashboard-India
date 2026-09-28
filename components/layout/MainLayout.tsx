"use client";

import React from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { useSidebar } from "./SidebarContext";
import { usePathname } from "next/navigation";

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
    const { isOpen, setIsOpen, isCollapsed, setIsCollapsed } = useSidebar();
    const pathname = usePathname();

    const isLoginPage = pathname === "/" || pathname?.startsWith("/login");

    if (isLoginPage) {
        return (
            <main className="min-h-screen w-full bg-background text-foreground">
                {children}
            </main>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#F5F7FB] text-foreground">
            <Sidebar
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Below lg the sidebar slides off screen, so this is the only
                    way back to it. It sits outside the scrolling area, so it
                    stays put while the page moves under it. */}
                <header className="lg:hidden flex items-center gap-2 h-14 px-4 bg-white border-b border-[#E2E8F0] shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        aria-label="Open navigation"
                        aria-expanded={isOpen}
                        className="p-2 -ml-2 rounded-xl text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-extrabold text-[#0F172A] tracking-tight">PathPulse.ai</span>
                </header>

                <main id="main-content" className="flex-1 bg-[#F5F7FB] overflow-y-auto overflow-x-hidden px-4 md:px-6 lg:px-8 py-4">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
