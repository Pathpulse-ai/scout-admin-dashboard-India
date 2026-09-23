import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    variant?: "default" | "success" | "warning" | "danger" | "info";
    className?: string;
}

const StatCard = ({ title, value, icon: Icon, variant = "default", className }: StatCardProps) => {
    const iconStyles = {
        default: "bg-[#02C394]/15 text-[#02C394]",
        success: "bg-[#02C394]/15 text-[#02C394]",
        info: "bg-[#02C394]/15 text-[#02C394]",
        warning: "bg-amber-500/15 text-amber-400",
        danger: "bg-rose-500/15 text-rose-400",
    };

    return (
        <div
            className={cn(
                "p-5 rounded-2xl border border-slate-800/80 bg-[#121e31]/80 backdrop-blur-md flex items-center gap-4 transition-all hover:border-slate-700 hover:shadow-lg shadow-sm group",
                className
            )}
        >
            <div
                className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 duration-300",
                    iconStyles[variant] || iconStyles.default
                )}
            >
                <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">
                    {title}
                </p>
                <p className="text-2xl font-black text-white tracking-tight group-hover:text-[#02C394] transition-colors">
                    {value}
                </p>
            </div>
        </div>
    );
};

export default StatCard;
