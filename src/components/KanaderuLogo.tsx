import React from 'react';

interface KanaderuLogoProps {
  className?: string;
  size?: number;
}

export const KanaderuLogo: React.FC<KanaderuLogoProps> = ({
  className = 'w-10 h-10',
  size = 40,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Background gradient: Deep Indigo -> Vibrant Violet -> Fuchsia */}
        <linearGradient id="kanaderu-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>

        {/* Shimmer overlay gradient */}
        <linearGradient id="kanaderu-glow" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
        </linearGradient>

        {/* Sparkle Gold Gradient */}
        <linearGradient id="kanaderu-sparkle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <filter id="kanaderu-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#4338CA" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Rounded squircle background */}
      <rect width="48" height="48" rx="14" fill="url(#kanaderu-bg)" />
      <rect width="48" height="48" rx="14" fill="url(#kanaderu-glow)" />

      {/* Subtle harmonic soundwaves */}
      <path
        d="M8 24C12 20 14 28 18 24C22 20 24 28 28 24"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.25"
      />

      {/* Harmonious Music Note: Single stem with elegant hooked flag and tilted notehead */}
      <g filter="url(#kanaderu-shadow)">
        {/* Note Head */}
        <ellipse
          cx="19"
          cy="31"
          rx="5"
          ry="3.8"
          transform="rotate(-22 19 31)"
          fill="white"
        />

        {/* Note Stem */}
        <path
          d="M23 30V15C23 14.4477 23.4477 14 24 14H24.5"
          stroke="white"
          strokeWidth="2.75"
          strokeLinecap="round"
        />

        {/* Note Flag curving dynamically */}
        <path
          d="M24 14C27.5 14.5 33 16.5 33 22C33 24 31 25.5 29.5 26"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Radiant Magic Sparkle 1 (Top right) */}
      <path
        d="M36 10C36 12.5 37.5 14 40 14C37.5 14 36 15.5 36 18C36 15.5 34.5 14 32 14C34.5 14 36 12.5 36 10Z"
        fill="url(#kanaderu-sparkle)"
      />

      {/* Small Ambient Sparkle 2 (Bottom right) */}
      <path
        d="M37 32C37 33.2 37.8 34 39 34C37.8 34 37 34.8 37 36C37 34.8 36.2 34 35 34C36.2 34 37 33.2 37 32Z"
        fill="#FFFFFF"
        fillOpacity="0.85"
      />

      {/* Tiny Sparkle 3 (Top left) */}
      <circle cx="12" cy="14" r="1.2" fill="#FFFFFF" fillOpacity="0.7" />
    </svg>
  );
};
