import React from 'react';

interface AdSlotProps {
  size: '300x250' | '728x90' | '160x600';
  className?: string;
}

const AdSlot: React.FC<AdSlotProps> = ({ size, className = '' }) => {
  const [width, height] = size.split('x').map(Number);

  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <div
      className={className}
      style={{ width, height }}
      data-ad-slot={size}
    />
  );
};

export default AdSlot;
