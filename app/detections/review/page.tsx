import { Suspense } from "react";
import ReviewClient from "./ReviewClient";

/**
 * Server shell for the full-screen review page.
 *
 * The case id lives in the query string rather than the path on purpose.
 * Changing a dynamic path segment remounts the client subtree, which would
 * throw away the loaded window and re-run a multi-second query on every arrow
 * press. A query-only change keeps the same mount.
 *
 * `ReviewClient` reads that query with useSearchParams, which bails out of
 * prerendering, so the Suspense boundary has to sit strictly above it here: a
 * component cannot catch its own bailout.
 */
export default function DetectionReviewPage() {
    return (
        <Suspense
            fallback={
                <div className="py-24 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 rounded-full border-2 border-[#00DF89] border-t-transparent animate-spin" />
                    <p className="text-xs text-[#64748B] font-bold uppercase tracking-widest">
                        Loading case&hellip;
                    </p>
                </div>
            }
        >
            <ReviewClient />
        </Suspense>
    );
}
