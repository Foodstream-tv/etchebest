/**
 * SDP helpers for the broadcast negotiation (pure, no native dependency).
 */

// Prioritize exactly H264 Constrained Baseline Profile (42e01f) with packetization-mode=1.
export function preferH264(sdp: string): string {
    if (!sdp) return sdp;
    const lines = sdp.split('\n');
    let targetPt = '';

    // 1. First, try to find an exact H264 profile match (42e01f).
    for (const line of lines) {
        const match = line.match(/^a=fmtp:(\d+)\s+.*profile-level-id=42e01f/i);
        if (match && line.includes('packetization-mode=1')) {
            targetPt = match[1];
            break;
        }
    }

    // 2. Fallback to any H264 payload type.
    if (!targetPt) {
        for (const line of lines) {
            const match = line.match(/^a=rtpmap:(\d+)\s+H264\//i);
            if (match) {
                targetPt = match[1];
                break;
            }
        }
    }

    if (!targetPt) return sdp;

    const videoPts = new Set<string>();
    for (const line of lines) {
        if (!line.startsWith('m=video ')) continue;
        const parts = line.trim().split(/\s+/);
        parts.slice(3).forEach((pt) => videoPts.add(pt));
    }

    // Keep H264 target PT and its RTX PT (if present).
    const keepPts = new Set<string>([targetPt]);
    for (const line of lines) {
        const rtxMatch = line.match(/^a=fmtp:(\d+)\s+apt=(\d+)/i);
        if (!rtxMatch) continue;
        if (rtxMatch[2] === targetPt) {
            keepPts.add(rtxMatch[1]);
        }
    }

    // 3. Reorder the m=video line to put the target PT first.
    const filtered = sdp.replace(/^(m=video\s+\S+\s+\S+)\s+(.+)$/gm, (match: string, prefix: string, pts: string) => {
        const all = pts.trim().split(/\s+/).filter((pt: string) => keepPts.has(pt));
        if (all.includes(targetPt)) {
            const others = all.filter((pt: string) => pt !== targetPt);
            return `${prefix} ${[targetPt, ...others].join(' ')}`;
        }
        return match;
    });

    // 4. Remove non-H264 video codec attributes from the offer.
    const filteredLines = filtered
        .split('\n')
        .filter((line) => {
            const m = line.match(/^a=(rtpmap|fmtp|rtcp-fb):(\d+)/i);
            if (!m) return true;
            const pt = m[2];
            if (!videoPts.has(pt)) return true;
            return keepPts.has(pt);
        });

    return filteredLines.join('\n');
}
