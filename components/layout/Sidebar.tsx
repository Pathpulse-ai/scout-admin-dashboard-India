"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home,
    ActivitySquare,
    Users,
    ShieldAlert,
    X,
    ChevronLeft,
    ChevronRight,
    Trophy,
    BarChart2,
    FileText,
    Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
    {
        id: "detections",
        label: "Detections",
        icon: ActivitySquare,
        href: "/detections",
    },
    {
        id: "analytics",
        label: "Scout Analytics",
        icon: Globe,
        href: "/analytics",
    },
    {
        id: "fraud",
        label: "Fraud Feed",
        icon: ShieldAlert,
        href: "/fraud",
    },
    {
        id: "admin-leaderboard",
        label: "Leaderboard",
        icon: BarChart2,
        href: "/leaderboard",
    },
];

const filteredNavigationItems = navigationItems;

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

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed lg:static inset-y-0 left-0 z-50 bg-sidebar flex flex-col border-r border-border-subtle transition-all duration-300 ease-in-out",
                    isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    isCollapsed ? "w-20" : "w-64"
                )}
            >
                {/* Logo Section */}
                <div className={cn("p-8 transition-all duration-300", isCollapsed ? "p-4 flex flex-col items-center" : "p-8")}>
                    <div className="flex items-center justify-between w-full">
                        <div className={cn("flex flex-col transition-all duration-300", isCollapsed ? "hidden" : "flex")}>
                            <h1 className="text-2xl font-bold text-brand-blue tracking-tight">
                                PathPulse<span className="text-brand-green">.ai</span> IN
                            </h1>
                            <p className="text-xs text-brand-gray font-medium uppercase tracking-widest mt-1">
                                Admin Console
                            </p>
                        </div>
                        {isCollapsed && (
                            <h1 className="text-2xl font-bold text-brand-blue tracking-tight">
                                P<span className="text-brand-green">.</span>
                            </h1>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="lg:hidden p-2 rounded-lg hover:bg-background text-brand-gray transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                    {filteredNavigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            pathname === item.href ||
                            (item.id === "admin-leaderboard" && (pathname === "/admin/leaderboard" || pathname === "/leaderboard")) ||
                            (item.id === "admin-winners" && (pathname === "/admin/winners" || pathname === "/winners"));

                        return (
                            <div key={item.id} className="flex flex-col">
                                <Link
                                    href={item.href !== "#" ? item.href : "#"}
                                    onClick={(e) => {
                                        if (item.href === "#") e.preventDefault();
                                        if (item.href !== "#") setIsOpen(false);
                                    }}
                                    title={isCollapsed ? item.label : ""}
                                    className={cn(
                                        "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                                        isCollapsed ? "justify-center px-2" : "gap-4 px-4",
                                        isActive && item.href !== "#"
                                            ? "bg-background text-brand-blue font-bold shadow-sm"
                                            : "text-brand-gray hover:bg-background hover:text-brand-blue"
                                    )}
                                >
                                    {isActive && !isCollapsed && item.href !== "#" && (
                                        <div className="absolute right-0 top-3 bottom-3 w-1 bg-brand-green rounded-full" />
                                    )}
                                    <Icon
                                        className={cn(
                                            "w-5 h-5 transition-colors shrink-0",
                                            isActive && item.href !== "#" ? "text-brand-green" : "text-brand-gray group-hover:text-brand-blue"
                                        )}
                                    />
                                    {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap overflow-hidden">{item.label}</span>}
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer info/Settings link */}
                <div className={cn("border-t border-border-subtle transition-all duration-300", isCollapsed ? "p-4" : "p-6")}>
                    <Link
                        href="/settings"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                            "flex items-center p-2 rounded-xl transition-all duration-200 hover:bg-background group",
                            isCollapsed ? "justify-center" : "gap-3"
                        )}
                    >
                        <div className="w-10 h-10 rounded-xl bg-brand-blue flex items-center justify-center text-white font-bold shrink-0">
                            AD
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-bold text-brand-blue leading-none truncate group-hover:text-brand-green">
                                    admin
                                </span>
                                <span className="text-xs text-brand-gray mt-1 truncate">Settings</span>
                            </div>
                        )}
                    </Link>
                </div>

                {/* Collapse Toggle Button (Desktop Only) */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-card border border-border-subtle rounded-full items-center justify-center text-brand-gray hover:text-brand-blue shadow-sm z-50 transition-colors cursor-pointer"
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </aside>
        </>
    );
};

export default Sidebar;
