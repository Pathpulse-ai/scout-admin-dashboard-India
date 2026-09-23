import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function safeToFixed(value: unknown, decimals: number = 2): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(num) ? 'N/A' : num.toFixed(decimals);
}
