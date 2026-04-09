import React from 'react';
import { cn } from '@/lib/utils';

interface CertifiedBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CertifiedBadge({ className, size = 'md' }: CertifiedBadgeProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <img
      src="https://i.pinimg.com/736x/57/f8/a9/57f8a9766284f883ff50fb76e7f0ad16.jpg"
      alt="Certified"
      className={cn(
        "inline-block rounded-full select-none pointer-events-none",
        sizeClasses[size],
        className
      )}
      referrerPolicy="no-referrer"
      onContextMenu={(e) => e.preventDefault()}
      draggable={false}
    />
  );
}
