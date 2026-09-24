import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    variant?: "default" | "success" | "warning" | "danger" | "info";
    className?: string;
    subtext?: string;
}

const StatCard = ({ title, value, icon: Icon, variant = "default", className, subtext }: StatCardProps) => {
    const iconStyles = {
        default: "bg-[#F1F5F9] text-[#475569]",
        success: "bg-[#D1FAE5] text-[#059669]",
        info: "bg-[#EFF6FF] text-[#2563EB]",
        warning: "bg-[#FEF3C7] text-[#D97706]",
        danger: "bg-[#FEE2E2] text-[#DC2626]",
    };

    return (
        <div
            className={cn(
                "p-5 rounded-[20px] border border-[#E2E8F0] bg-white shadow-sm flex items-start justify-between gap-4 transition-all duration-200 hover:shadow-md group",
                className
            )}
        >
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#64748B] leading-none mb-1.5 truncate">
                    {title}
                </p>
                <p className="text-3xl font-black text-[#0F172A] tracking-tight font-mono">
                    {value}
                </p>
                {subtext && (
                    <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5 truncate">
                        {subtext}
                    </p>
                )}
            </div>
            <div
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 duration-200",
                    iconStyles[variant] || iconStyles.default
                )}
            >
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );
};

export default StatCard;
