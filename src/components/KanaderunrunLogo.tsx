import React from 'react';

interface KanaderunrunLogoProps {
  className?: string;
  size?: number;
}

export const KanaderunrunLogo: React.FC<KanaderunrunLogoProps> = ({
  className = 'w-10 h-10',
  size = 40,
}) => (
  <img
    src={`${import.meta.env.BASE_URL}favicon_io/android-icon-192x192.png`}
    alt=""
    width={size}
    height={size}
    className={className}
    draggable={false}
  />
);
