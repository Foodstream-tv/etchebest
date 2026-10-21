/**
 * Hand-off of what the Studio collected to the broadcast screen. The description (with the whole recipe
 * after the marker) and the thumbnail are large and full of characters that do not survive a route
 * parameter reliably (URL encoding, %, length): a live was once created with an empty description although
 * a Marmiton recipe had been imported. They travel in memory, the route only carries the draft id.
 */
export type LiveDraft = {
    description: string;
    thumbnailUrl?: string;
    /** False: no replay is kept (the Studio switch). Absent means yes. */
    recordReplay?: boolean;
};

const MAX_DRAFTS = 5;
const drafts = new Map<string, LiveDraft>();
let counter = 0;

export function setLiveDraft(draft: LiveDraft): string {
    counter += 1;
    const id = `draft-${counter}`;
    drafts.set(id, draft);
    // Only the latest few matter (one broadcast at a time): forget the oldest.
    while (drafts.size > MAX_DRAFTS) {
        const oldest = drafts.keys().next().value;
        if (oldest === undefined) break;
        drafts.delete(oldest);
    }
    return id;
}

export function getLiveDraft(id: string | undefined | null): LiveDraft | null {
    return (id && drafts.get(id)) || null;
}

/** Test helper. */
export function clearLiveDrafts() {
    drafts.clear();
    counter = 0;
}
