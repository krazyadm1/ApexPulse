import React, { useState, useEffect } from 'react';

interface CoachMarkProps {
  id: string;
  message: string;
  children: React.ReactNode;
}

const CoachMark: React.FC<CoachMarkProps> = ({ id, message, children }) => {
  const storageKey = `apexpulse_coach_${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  return (
    <div className="relative">
      {children}
      {visible && (
        <div className="absolute z-40 top-full left-0 mt-2 w-64 bg-apex-cyan/10 border border-apex-cyan/30 rounded-lg p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <span className="text-apex-cyan text-xs font-bold shrink-0 mt-0.5">TIP</span>
            <p className="text-[var(--text-primary)] text-xs leading-relaxed flex-1">{message}</p>
            <button onClick={dismiss} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm shrink-0">&times;</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachMark;
