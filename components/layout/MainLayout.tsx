"use client";

import React from "react";
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
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 lg:px-8 py-4">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
