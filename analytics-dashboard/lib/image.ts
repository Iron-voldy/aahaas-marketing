export function isRemoteImageUrl(src?: string | null): boolean {
    return typeof src === "string" && /^https?:\/\//i.test(src);
}

export function shouldBypassNextImageOptimization(src?: string | null): boolean {
    if (!isRemoteImageUrl(src)) return false;

    try {
        const url = new URL(src as string);
        // Bypass optimization for all external CDNs (Firebase, Facebook, Instagram, etc.)
        const bypassHosts = [
            "firebasestorage.googleapis.com",
            "scontent",         // Facebook CDN (scontent-xxx.xx.fbcdn.net)
            "fbcdn.net",
            "cdninstagram.com",
            "instagram",
        ];
        return bypassHosts.some(h => url.hostname.includes(h));
    } catch {
        return false;
    }
}

/**
 * Detect if a URL points to a video (FB/IG video post).
 * Used to decide whether to render an <iframe> embed vs <img>.
 */
export function isVideoUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(mp4|webm|mov|avi)/i.test(url) || /\/videos?\//i.test(url);
}

/**
 * Try to extract a Facebook post embed URL from a permalink.
 * Returns the oEmbed-compatible URL for iframe embedding.
 */
export function getFacebookEmbedUrl(permalink?: string | null): string | null {
    if (!permalink) return null;
    if (permalink.includes("facebook.com") || permalink.includes("fb.com")) {
        return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(permalink)}&show_text=false&width=500`;
    }
    return null;
}

/**
 * Try to extract an Instagram post embed URL from a permalink.
 */
export function getInstagramEmbedUrl(permalink?: string | null): string | null {
    if (!permalink) return null;
    if (permalink.includes("instagram.com")) {
        // Strip query params and add /embed/
        const clean = permalink.split("?")[0].replace(/\/$/, "");
        return `${clean}/embed/`;
    }
    return null;
}
