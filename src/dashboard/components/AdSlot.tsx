import React, { useRef, useEffect, useState } from 'react';

interface AdSlotProps {
  size: '300x250' | '728x90' | '160x600';
  className?: string;
}

const AdSlot: React.FC<AdSlotProps> = ({ size, className = '' }) => {
  const [width, height] = size.split('x').map(Number);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className={className}
      style={{ width, height }}
      data-ad-slot={size}
    />
  );
};

export default AdSlot;
