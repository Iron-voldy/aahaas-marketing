// Official Facebook Logo SVG
export function FacebookLogo({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Facebook"
            role="img"
        >
            <rect width="24" height="24" rx="6" fill="#1877F2" />
            <path
                d="M16.5 12H14V10.5C14 9.947 14.447 9.5 15 9.5H16V7.5H14.5C12.567 7.5 11 9.067 11 11V12H9V14H11V21H14V14H15.5L16.5 12Z"
                fill="white"
            />
        </svg>
    );
}

// Official Instagram Logo SVG (gradient)
export function InstagramLogo({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Instagram"
            role="img"
        >
            <defs>
                <radialGradient
                    id="ig-grad-a"
                    cx="30%"
                    cy="107%"
                    r="150%"
                >
                    <stop offset="0%" stopColor="#fdf497" />
                    <stop offset="5%" stopColor="#fdf497" />
                    <stop offset="45%" stopColor="#fd5949" />
                    <stop offset="60%" stopColor="#d6249f" />
                    <stop offset="90%" stopColor="#285AEB" />
                </radialGradient>
            </defs>
            <rect width="24" height="24" rx="6" fill="url(#ig-grad-a)" />
            {/* Camera outline */}
            <rect x="6" y="6" width="12" height="12" rx="3.5" stroke="white" strokeWidth="1.4" fill="none" />
            {/* Center circle */}
            <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.4" fill="none" />
            {/* Dot top-right */}
            <circle cx="16.2" cy="7.8" r="0.85" fill="white" />
        </svg>
    );
}

// Small inline badge versions (for table cells)
export function FacebookBadge() {
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#1877F2]/10 text-[#1877F2] dark:bg-[#1877F2]/20 dark:text-[#4ba3ff] text-[11px] font-semibold">
            <FacebookLogo className="w-3 h-3" />
            Facebook
        </span>
    );
}

export function InstagramBadge() {
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400 text-[11px] font-semibold">
            <InstagramLogo className="w-3 h-3" />
            Instagram
        </span>
    );
}
