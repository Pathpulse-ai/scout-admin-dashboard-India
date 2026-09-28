"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDetectionTypeLabel } from "@/lib/detectionLabels";

/**
 * "Which class is this?" — shown right after an officer captures a frame or a
 * clip. The capture is previewed so the label is applied to what was actually
 * taken, not to whatever the video has moved on to.
 */
export interface ClassLabelDialogProps {
    open: boolean;
    title: string;
    subtitle?: string;
    preview: { kind: "frame" | "clip"; url: string } | null;
    classes: { detection_type: string; total?: number }[];
    isSaving: boolean;
    onSelect: (detectionType: string) => void;
    onCancel: () => void;
}

export default function ClassLabelDialog({
    open,
    title,
    subtitle,
    preview,
    classes,
    isSaving,
    onSelect,
    onCancel,
}: ClassLabelDialogProps) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = classes.filter((c) => {
            if (!q) return true;
            return (
                c.detection_type.toLowerCase().includes(q) ||
                formatDetectionTypeLabel(c.detection_type).toLowerCase().includes(q)
            );
        });
        return list.sort((a, b) =>
            formatDetectionTypeLabel(a.detection_type).localeCompare(formatDetectionTypeLabel(b.detection_type))
        );
    }, [classes, query]);

    // Fresh search and focus each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setQuery("");
        const id = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
    }, [open]);

    // Escape cancels; Enter takes the first match so the keyboard flow is
    // S/V, type a few letters, Enter.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (isSaving) return;
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            } else if (
                e.key === "Enter" &&
                e.target === inputRef.current &&
                query.trim() &&
                matches.length > 0
            ) {
                // Only while typing a filter, and only once something is typed:
                // the same condition that highlights the top row, so Enter never
                // saves under a class the officer could not see was selected. A
                // focused class button or Cancel keeps its own native Enter.
                e.preventDefault();
                e.stopPropagation();
                onSelect(matches[0].detection_type);
            }
        };
        window.addEventListener("keydown", onKey, { capture: true });
        return () => window.removeEventListener("keydown", onKey, { capture: true });
    }, [open, isSaving, matches, query, onSelect, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={isSaving ? undefined : onCancel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-[#E2E8F0] overflow-hidden grid grid-cols-1 md:grid-cols-[1.1fr_1fr] max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* What was captured */}
                <div className="bg-[#0B1528] flex items-center justify-center min-h-[220px] md:min-h-[360px]">
                    {preview?.kind === "frame" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt="Captured frame" className="w-full h-full object-contain" />
                    )}
                    {preview?.kind === "clip" && (
                        <video
                            src={preview.url}
                            controls
                            autoPlay
                            muted
                            data-silent=""
                            onVolumeChange={(e) => {
                                if (!e.currentTarget.muted) e.currentTarget.muted = true;
                            }}
                            loop
                            playsInline
                            className="w-full h-full object-contain"
                        />
                    )}
                </div>

                {/* Pick a class */}
                <div className="flex flex-col min-h-0">
                    <div className="flex items-start justify-between gap-3 p-5 border-b border-[#E2E8F0]">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                                <Tag className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-base font-extrabold text-[#0F172A] tracking-tight">{title}</h3>
                                {subtitle && (
                                    <p className="text-[11px] font-medium text-[#64748B] mt-0.5">{subtitle}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            disabled={isSaving}
                            aria-label="Cancel"
                            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 border-b border-[#E2E8F0]">
                        <div className="relative">
                            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Type to filter classes, Enter picks the first"
                                disabled={isSaving}
                                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-3 py-2 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89]"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 min-h-0">
                        {matches.length === 0 ? (
                            <p className="py-10 text-center text-xs font-semibold text-[#94A3B8]">
                                No class matches &ldquo;{query}&rdquo;.
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {matches.map((c, i) => (
                                    <li key={c.detection_type}>
                                        <button
                                            onClick={() => onSelect(c.detection_type)}
                                            disabled={isSaving}
                                            className={cn(
                                                "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer disabled:opacity-50",
                                                i === 0 && query
                                                    ? "bg-[#E6FAF2] border border-[#A7F3D0]"
                                                    : "hover:bg-[#F8FAFC] border border-transparent"
                                            )}
                                        >
                                            <span className="min-w-0">
                                                <span className="block text-sm font-bold text-[#0F172A] truncate">
                                                    {formatDetectionTypeLabel(c.detection_type)}
                                                </span>
                                                <span className="block text-[10px] font-mono text-[#94A3B8] truncate">
                                                    {c.detection_type}
                                                </span>
                                            </span>
                                            {typeof c.total === "number" && (
                                                <span className="text-[10px] font-bold text-[#64748B] font-mono shrink-0">
                                                    {c.total.toLocaleString()}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-2">
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00DF89]" />
                                    Saving to validated images&hellip;
                                </>
                            ) : (
                                <>
                                    <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#0F172A]">Esc</kbd>
                                    discard capture
                                </>
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
