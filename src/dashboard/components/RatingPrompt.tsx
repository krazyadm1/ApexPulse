import React, { useState } from 'react';

interface RatingPromptProps {
  onDismiss: () => void;
}

const RatingPrompt: React.FC<RatingPromptProps> = ({ onDismiss }) => {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    localStorage.setItem('apexpulse_rated', 'true');
    if (rating >= 4) {
      setSubmitted(true);
    } else {
      window.open('https://discord.gg/Pfd6ScNaSW', '_blank');
      onDismiss();
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 max-w-sm text-center shadow-2xl">
          <div className="text-3xl mb-3">🎉</div>
          <p className="text-[var(--text-primary)] font-bold mb-2">Thanks for the love!</p>
          <p className="text-[var(--text-secondary)] text-sm mb-4">If you want to support us, tell your squad about ApexPulse.</p>
          <button onClick={onDismiss} className="bg-apex-cyan text-apex-dark font-bold px-6 py-2 rounded-lg">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 max-w-sm shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-[var(--text-primary)] font-bold">Enjoying ApexPulse?</h3>
          <button onClick={onDismiss} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">&times;</button>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-4">You've tracked a few matches now. How are we doing?</p>

        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-2xl transition-transform hover:scale-110 ${
                star <= rating ? 'text-yellow-400' : 'text-[var(--text-muted)]'
              }`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 border border-[var(--border)] px-4 py-2 rounded-lg text-[var(--text-secondary)] text-sm hover:bg-[var(--hover)]"
          >
            Not now
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className={`flex-1 font-bold px-4 py-2 rounded-lg text-sm ${
              rating > 0 ? 'bg-apex-cyan text-apex-dark' : 'bg-[var(--hover)] text-gray-500 cursor-not-allowed'
            }`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingPrompt;
