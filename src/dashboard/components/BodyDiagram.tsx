import React from 'react';

interface BodyDiagramProps {
  headshotPct: number;
  bodyshotPct: number;
}

const BodyDiagram: React.FC<BodyDiagramProps> = ({ headshotPct, bodyshotPct }) => {
  const headColor = `rgba(0,229,255,${Math.max(headshotPct / 100, 0.2)})`;
  const bodyColor = `rgba(0,200,200,${Math.max(bodyshotPct / 100, 0.2)})`;

  return (
    <div className="flex items-center justify-center gap-10">
      <div className="relative w-28">
        <svg viewBox="0 0 200 480" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
          {/* Head */}
          <ellipse cx="100" cy="42" rx="28" ry="34"
            fill={headColor} stroke="rgba(0,229,255,0.6)" strokeWidth="1.5"
          />
          {/* Neck */}
          <path d="M88 74 L88 92 Q88 96 92 96 L108 96 Q112 96 112 92 L112 74"
            fill={bodyColor} stroke="rgba(0,200,200,0.3)" strokeWidth="1"
          />
          {/* Shoulders + Torso */}
          <path d="M92 96 L60 104 Q42 108 40 120 L36 180 L38 220 Q40 240 50 248 L56 252
                   L56 260 Q58 268 66 268 L80 268 Q84 268 84 264 L86 252
                   L100 256
                   L114 252 L116 264 Q116 268 120 268 L134 268 Q142 268 144 260 L144 252 L150 248
                   Q160 240 162 220 L164 180 L160 120 Q158 108 140 104 L108 96"
            fill={bodyColor} stroke="rgba(0,200,200,0.4)" strokeWidth="1.5"
          />
          {/* Left arm */}
          <path d="M40 120 L28 160 Q24 172 22 186 L18 230 Q16 244 20 250 L26 256
                   Q32 260 36 256 L38 248 L34 210 L36 186 Q38 170 42 158 L54 124"
            fill={bodyColor} stroke="rgba(0,200,200,0.3)" strokeWidth="1"
            opacity="0.7"
          />
          {/* Right arm */}
          <path d="M160 120 L172 160 Q176 172 178 186 L182 230 Q184 244 180 250 L174 256
                   Q168 260 164 256 L162 248 L166 210 L164 186 Q162 170 158 158 L146 124"
            fill={bodyColor} stroke="rgba(0,200,200,0.3)" strokeWidth="1"
            opacity="0.7"
          />
          {/* Left leg */}
          <path d="M72 260 L66 320 L62 380 L58 420 Q56 436 60 444 L66 450
                   Q72 454 78 450 L82 444 Q84 438 82 424 L86 380 L88 320 L90 268"
            fill={bodyColor} stroke="rgba(0,200,200,0.25)" strokeWidth="1"
            opacity="0.6"
          />
          {/* Right leg */}
          <path d="M128 260 L134 320 L138 380 L142 420 Q144 436 140 444 L134 450
                   Q128 454 122 450 L118 444 Q116 438 118 424 L114 380 L112 320 L110 268"
            fill={bodyColor} stroke="rgba(0,200,200,0.25)" strokeWidth="1"
            opacity="0.6"
          />
        </svg>
      </div>
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-3xl font-bold text-cyan-400 font-mono leading-none">{headshotPct.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">of Hits</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em] mt-0.5 font-semibold">Headshots</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-teal-400 font-mono leading-none">{bodyshotPct.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">of Hits</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em] mt-0.5 font-semibold">Body Shots</div>
        </div>
      </div>
    </div>
  );
};

export default BodyDiagram;
