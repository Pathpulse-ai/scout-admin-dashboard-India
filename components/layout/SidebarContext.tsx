"use client";

import React, { createContext, useContext, useState } from "react";

interface SidebarContextType {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    isCollapsed: boolean;
    setIsCollapsed: (isCollapsed: boolean) => void;
    toggle: () => void;
}

const defaultContext: SidebarContextType = {
    isOpen: false,
    setIsOpen: () => {},
    isCollapsed: false,
    setIsCollapsed: () => {},
    toggle: () => {},
};

const SidebarContext = createContext<SidebarContextType>(defaultContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggle = () => setIsOpen((prev) => !prev);

    return (
        <SidebarContext.Provider value={{ isOpen, setIsOpen, isCollapsed, setIsCollapsed, toggle }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    return context ?? defaultContext;
};
