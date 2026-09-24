"use client";

import React from "react";
import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface PageHeaderProps {
    title: string;
    subtitle: string;
    actions?: React.ReactNode;
}

const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => {
    const { setIsOpen } = useSidebar();
    return (
        <header className="py-4 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 backdrop-blur-md z-30">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                    onClick={() => setIsOpen(true)}
                    className="lg:hidden p-2 sm:p-2.5 rounded-xl bg-card shadow-sm border border-border-subtle text-brand-blue hover:bg-gray-50 dark:hover:bg-card/80 transition-colors shrink-0"
                    aria-label="Open Navigation"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs font-bold text-black uppercase tracking-widest mb-0.5 sm:mb-1 truncate">
                        {subtitle}
                    </p>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-black tracking-tight truncate">
                        {title}
                    </h2>
                </div>
            </div>

            {actions && (
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                    {actions}
                </div>
            )}
        </header>
    );
};

export default PageHeader;
