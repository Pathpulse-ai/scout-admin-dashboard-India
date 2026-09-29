"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Numbered pages for the evidence grid.
 *
 * Pages are zero-based in props and one-based on screen. A big class runs to
 * thousands of pages, so only a window around the current page is numbered,
 * with the first and last always present and a box to jump to any page.
 */
export interface PagerProps {
    page: number;
    pageCount: number;
    /** While a page is loading, so a double click cannot skip two pages. */
    disabled?: boolean;
    onChange: (page: number) => void;
}

/** The page numbers to show: first, last, and a window around the current one. */
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);

    const wanted = new Set<number>([0, pageCount - 1, page - 1, page, page + 1]);
    // Near either end the window widens, so the row keeps about the same
    // number of buttons wherever the cursor is.
    if (page <= 2) [1, 2, 3].forEach((p) => wanted.add(p));
    if (page >= pageCount - 3) [pageCount - 4, pageCount - 3, pageCount - 2].forEach((p) => wanted.add(p));

    const sorted = Array.from(wanted)
        .filter((p) => p >= 0 && p < pageCount)
        .sort((a, b) => a - b);

    const out: (number | "gap")[] = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
        out.push(p);
    });
    return out;
}

const buttonBase =
    "h-9 min-w-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none";
const buttonIdle =
    "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#00DF89] hover:text-[#0F172A] cursor-pointer";

export default function Pager({ page, pageCount, disabled = false, onChange }: PagerProps) {
    /** What is typed in the jump box; cleared once it has been used. */
    const [draft, setDraft] = useState("");

    const go = (next: number) => {
        const clamped = Math.min(Math.max(0, next), pageCount - 1);
        setDraft("");
        if (clamped !== page) onChange(clamped);
    };

    const jump = () => {
        const n = Number.parseInt(draft, 10);
        if (Number.isFinite(n)) go(n - 1);
        else setDraft("");
    };

    return (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
                onClick={() => go(page - 1)}
                disabled={disabled || page <= 0}
                aria-label="Previous page"
                className={cn(buttonBase, buttonIdle)}
            >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
            </button>

            {pageWindow(page, pageCount).map((entry, i) =>
                entry === "gap" ? (
                    <span key={`gap-${i}`} className="px-1 text-xs font-bold text-[#94A3B8]">
                        &hellip;
                    </span>
                ) : (
                    <button
                        key={entry}
                        onClick={() => go(entry)}
                        disabled={disabled}
                        aria-current={entry === page ? "page" : undefined}
                        className={cn(
                            buttonBase,
                            entry === page ? "bg-[#0B1528] text-white shadow-sm cursor-default" : buttonIdle
                        )}
                    >
                        {(entry + 1).toLocaleString()}
                    </button>
                )
            )}

            <button
                onClick={() => go(page + 1)}
                disabled={disabled || page >= pageCount - 1}
                aria-label="Next page"
                className={cn(buttonBase, buttonIdle)}
            >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="w-4 h-4" />
            </button>

            {pageCount > 7 && (
                <label className="flex items-center gap-2 ml-2 text-xs font-semibold text-[#64748B]">
                    Go to
                    <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                jump();
                            }
                        }}
                        onBlur={() => {
                            if (draft) jump();
                        }}
                        placeholder={String(page + 1)}
                        disabled={disabled}
                        aria-label="Go to page"
                        className="w-20 h-9 bg-white border border-[#E2E8F0] rounded-xl px-3 text-xs font-bold text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89] disabled:opacity-40"
                    />
                    <span className="text-[#94A3B8]">of {pageCount.toLocaleString()}</span>
                </label>
            )}
        </nav>
    );
}
