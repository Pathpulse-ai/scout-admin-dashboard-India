"use client";

import React, { useEffect, useRef } from "react";
import { Check, Gavel, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Asked every time an officer validates a detection: is the frame good enough
 * to stand as court evidence?
 *
 * The answer is deliberately separate from the validate decision itself, so a
 * case can be validated and still be marked not court ready.
 */
export interface CourtReadyDialogProps {
    /** The case being validated; null keeps the dialog closed. */
    caseLabel: string | null;
    isSaving: boolean;
    onAnswer: (courtReady: boolean) => void;
    onCancel: () => void;
}

export default function CourtReadyDialog({
    caseLabel,
    isSaving,
    onAnswer,
    onCancel,
}: CourtReadyDialogProps) {
    const isOpen = caseLabel !== null;

    // Latest-ref indirection keeps one listener across renders without the
    // handler freezing on the first render's props.
    const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
    useEffect(() => {
        handlerRef.current = (e: KeyboardEvent) => {
            if (!isOpen || isSaving) return;
            if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;

            const key = e.key.toLowerCase();
            const isYes = key === "y";
            const isNo = key === "n";
            const isCancel = key === "escape";
            if (!isYes && !isNo && !isCancel) return;

            e.preventDefault();
            e.stopPropagation();

            if (isCancel) onCancel();
            else onAnswer(isYes);
        };
    });

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => handlerRef.current(e);
        // Capture, so this runs before the review page's own shortcut handler.
        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={isSaving ? undefined : onCancel}
            role="dialog"
            aria-modal="true"
            aria-label="Court ready"
        >
            <div
                className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E2E8F0] space-y-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                        <Gavel className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-extrabold text-[#0F172A] tracking-tight">
                            Is this image court ready?
                        </h3>
                        <p className="text-xs font-medium text-[#64748B] mt-1">
                            Confirm whether the frame is clear enough to stand as evidence. The
                            case is validated either way; your answer is recorded with it.
                        </p>
                        {caseLabel && (
                            <p className="text-[11px] font-mono font-bold text-[#94A3B8] mt-2 truncate">
                                {caseLabel}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => onAnswer(true)}
                        disabled={isSaving}
                        className={cn(
                            "flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                            "bg-[#00DF89] hover:bg-[#00DF89]/90 text-slate-950 shadow-md shadow-[#00DF89]/20",
                            "disabled:opacity-50 disabled:pointer-events-none"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4 stroke-[2.5]" />
                        )}
                        <span>Yes, court ready</span>
                        <kbd className="bg-black/10 rounded px-1.5 py-0.5 font-mono text-[10px]">Y</kbd>
                    </button>

                    <button
                        onClick={() => onAnswer(false)}
                        disabled={isSaving}
                        className="flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                        <span>No, not court ready</span>
                        <kbd className="bg-black/10 rounded px-1.5 py-0.5 font-mono text-[10px]">N</kbd>
                    </button>
                </div>

                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="w-full py-2.5 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                    Cancel &mdash; do not validate
                    <kbd className="ml-2 bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#0F172A]">
                        Esc
                    </kbd>
                </button>
            </div>
        </div>
    );
}
