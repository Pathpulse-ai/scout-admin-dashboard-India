"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        if (typeof document !== "undefined") {
            document.documentElement.setAttribute("data-theme", newTheme);
        }
        try {
            localStorage.setItem("theme", newTheme);
        } catch {
            // Handled
        }
    };

    const toggleTheme = () => {
        const nextTheme = theme === "light" ? "dark" : "light";
        setTheme(nextTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        return {
            theme: "light" as Theme,
            toggleTheme: () => {},
            setTheme: () => {},
        };
    }
    return context;
}
