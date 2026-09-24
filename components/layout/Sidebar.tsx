"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Scan,
    Users,
    X,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
    {
        id: "analytics",
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/analytics",
    },
    {
        id: "detections",
        label: "Detections",
        icon: Scan,
        href: "/detections",
    },
    {
        id: "users",
        label: "User Discovery",
        icon: Users,
        href: "/users",
    },
];

const BrandMark = ({ className }: { className?: string }) => (
    <div
        className={cn(
            "rounded-xl bg-gradient-to-br from-[#00DF89] to-[#02A878] flex items-center justify-center shrink-0",
            className
        )}
    >
        <svg viewBox="0 0 24 24" fill="none" className="w-[60%] h-[60%]" stroke="#04140D" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12.5h3.6L9 6.5l3.2 11 2.6-5h3.7" />
        </svg>
    </div>
);

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    isCollapsed: boolean;
    setIsCollapsed: (isCollapsed: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }: SidebarProps) => {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={cn(
                    "fixed lg:static inset-y-0 left-0 z-50 bg-[#050B18] border-r border-white/[0.06] flex flex-col transition-all duration-300 ease-in-out shrink-0 select-none",
                    isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    isCollapsed ? "w-[72px]" : "w-64"
                )}
            >
                {/* Brand */}
                <div
                    className={cn(
                        "h-16 flex items-center border-b border-white/[0.06]",
                        isCollapsed ? "justify-center px-0" : "px-5"
                    )}
                >
                    {isCollapsed ? (
                        <Link href="/analytics" aria-label="PathPulse.ai Admin Console">
                            <BrandMark className="w-9 h-9" />
                        </Link>
                    ) : (
                        <div className="flex items-center justify-between w-full gap-3">
                            <Link href="/analytics" className="flex items-center gap-3 min-w-0">
                                <BrandMark className="w-9 h-9" />
                                <span className="flex flex-col min-w-0 leading-none">
                                    <span className="text-[15px] font-bold text-white tracking-tight truncate">
                                        PathPulse.ai
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium truncate mt-1">
                                        Admin Console India
                                    </span>
                                </span>
                            </Link>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                aria-label="Close sidebar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto", isCollapsed ? "px-3" : "px-3")}>
                    {!isCollapsed && (
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.12em] px-3 pb-2">
                            Overview
                        </p>
                    )}
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            pathname === item.href ||
                            (item.id === "analytics" && (pathname === "/analytics" || pathname === "/dashboard"));

                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                title={isCollapsed ? item.label : undefined}
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                    "flex items-center rounded-lg text-sm transition-colors duration-150 group",
                                    isCollapsed ? "justify-center h-10" : "gap-3 px-3 h-10",
                                    isActive
                                        ? "bg-[#00DF89]/10 text-[#00DF89] font-semibold"
                                        : "text-slate-400 hover:text-white hover:bg-white/[0.05] font-medium"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-[18px] h-[18px] shrink-0",
                                        isActive ? "text-[#00DF89]" : "text-slate-500 group-hover:text-white"
                                    )}
                                />
                                {!isCollapsed && (
                                    <span className="truncate tracking-tight">{item.label}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className={cn("border-t border-white/[0.06] p-3", isCollapsed && "flex justify-center")}>
                    <Link
                        href="/settings"
                        onClick={() => setIsOpen(false)}
                        title={isCollapsed ? "PathPulse Enterprise Platform" : undefined}
                        className={cn(
                            "flex items-center rounded-lg transition-colors duration-150 hover:bg-white/[0.05] group",
                            isCollapsed ? "justify-center w-10 h-10" : "gap-3 px-2 py-2"
                        )}
                    >
                        <div className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/10 flex items-center justify-center text-[#00DF89] font-bold text-[11px] shrink-0">
                            PP
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col min-w-0 leading-none">
                                <span className="text-[13px] font-semibold text-white truncate group-hover:text-[#00DF89] transition-colors">
                                    PathPulse
                                </span>
                                <span className="text-[11px] text-slate-500 truncate mt-1 font-medium">
                                    Enterprise Platform
                                </span>
                            </div>
                        )}
                    </Link>
                </div>

                {/* Desktop Collapse Toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex absolute -right-3 top-[60px] w-6 h-6 bg-[#0B1528] border border-white/10 rounded-full items-center justify-center text-slate-400 hover:text-white hover:border-[#00DF89]/50 z-50 transition-colors cursor-pointer"
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </button>
            </aside>
        </>
    );
};

export default Sidebar;
