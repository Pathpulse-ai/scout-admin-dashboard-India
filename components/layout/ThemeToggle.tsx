"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-card border border-border-subtle text-brand-gray hover:text-brand-blue shadow-sm transition-all duration-200 cursor-pointer"
            aria-label="Toggle Theme"
        >
            {theme === "light" ? (
                <Moon className="w-5 h-5" />
            ) : (
                <Sun className="w-5 h-5 shrink-0" />
            )}
        </button>
    );
};

export default ThemeToggle;
