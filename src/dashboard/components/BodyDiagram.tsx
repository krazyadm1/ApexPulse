import React from 'react';

interface BodyDiagramProps {
  headshotPct: number;
  bodyshotPct: number;
}

const BodyDiagram: React.FC<BodyDiagramProps> = ({ headshotPct, bodyshotPct }) => {
  const headGlow = Math.max(headshotPct / 100, 0.25);
  const bodyGlow = Math.max(bodyshotPct / 100, 0.2);
  const edgeColor = `rgba(255,170,50,${bodyGlow * 0.8})`;
  const headEdge = `rgba(0,229,255,${headGlow})`;

  return (
    <div className="flex items-center justify-center gap-10">
      <div className="relative w-32">
        <svg viewBox="0 0 200 500" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="headGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor={`rgba(60,30,10,${bodyGlow * 0.6})`} />
              <stop offset="100%" stopColor={`rgba(20,10,5,${bodyGlow * 0.9})`} />
            </radialGradient>
          </defs>

          {/* ===== HEAD ===== */}
          {/* Skull / helmet shape */}
          <path
            d="M100 18
               C 72 18, 62 38, 62 54
               C 62 68, 66 76, 74 82
               L 74 88 Q 78 94, 88 96
               L 112 96 Q 122 94, 126 88
               L 126 82
               C 134 76, 138 68, 138 54
               C 138 38, 128 18, 100 18 Z"
            fill={`rgba(15,8,4,${headGlow * 0.9})`}
            stroke={headEdge}
            strokeWidth="1.5"
            filter="url(#glow)"
          />
          {/* Visor / eye — glowing cyan */}
          <ellipse cx="100" cy="52" rx="18" ry="10"
            fill={`rgba(0,229,255,${headGlow})`}
            stroke={`rgba(0,229,255,${headGlow * 0.6})`}
            strokeWidth="1"
            filter="url(#headGlow)"
          />
          {/* Visor inner glow dot */}
          <ellipse cx="100" cy="52" rx="8" ry="5"
            fill={`rgba(0,255,255,${headGlow * 0.5})`}
          />

          {/* ===== NECK ===== */}
          <path
            d="M88 96 L88 110 Q 90 114, 100 114 Q 110 114, 112 110 L112 96"
            fill="rgba(15,8,4,0.8)"
            stroke={edgeColor}
            strokeWidth="1"
          />

          {/* ===== SHOULDERS + TORSO ===== */}
          {/* Shoulder ridge left */}
          <path
            d="M88 112 L50 122 Q 38 126, 36 134 L38 140 L54 136 L88 128"
            fill="url(#bodyGrad)"
            stroke={edgeColor}
            strokeWidth="1.2"
            filter="url(#glow)"
          />
          {/* Shoulder ridge right */}
          <path
            d="M112 112 L150 122 Q 162 126, 164 134 L162 140 L146 136 L112 128"
            fill="url(#bodyGrad)"
            stroke={edgeColor}
            strokeWidth="1.2"
            filter="url(#glow)"
          />

          {/* Main torso */}
          <path
            d="M70 128
               L64 140 L60 200 L58 260
               Q 58 272, 68 274
               L 84 276 L 100 278 L 116 276 L 132 274
               Q 142 272, 142 260
               L 140 200 L136 140 L130 128 Z"
            fill="url(#bodyGrad)"
            stroke={edgeColor}
            strokeWidth="1.3"
            filter="url(#glow)"
          />
          {/* Chest center line */}
          <line x1="100" y1="130" x2="100" y2="270"
            stroke={`rgba(255,170,50,${bodyGlow * 0.2})`} strokeWidth="0.8"
          />
          {/* Chest plate upper edge */}
          <path
            d="M72 160 Q 100 155, 128 160"
            fill="none" stroke={`rgba(255,170,50,${bodyGlow * 0.3})`} strokeWidth="0.8"
          />
          {/* Belt line */}
          <path
            d="M62 255 L138 255"
            stroke={edgeColor} strokeWidth="1.5"
          />
          {/* Belt glow */}
          <rect x="88" y="250" width="24" height="10" rx="2"
            fill={`rgba(255,170,50,${bodyGlow * 0.25})`}
          />

          {/* ===== LEFT ARM ===== */}
          {/* Upper arm */}
          <path
            d="M38 140 L32 146 L26 198 Q 26 206, 30 208
               L 42 208 Q 46 206, 46 198 L 50 148 L 46 140"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1"
            filter="url(#glow)"
          />
          {/* Elbow joint */}
          <ellipse cx="36" cy="216" rx="10" ry="6"
            fill="rgba(15,8,4,0.6)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.4})`}
            strokeWidth="0.8"
          />
          {/* Forearm */}
          <path
            d="M26 222 L24 270 Q 24 278, 28 280
               L 44 280 Q 48 278, 48 270 L 46 222 Z"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1"
            filter="url(#glow)"
          />
          {/* Hand */}
          <path
            d="M28 280 L26 296 Q 28 302, 34 302
               L 40 302 Q 46 300, 44 294 L 44 280"
            fill="rgba(15,8,4,0.8)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.3})`}
            strokeWidth="0.8"
          />

          {/* ===== RIGHT ARM ===== */}
          <path
            d="M162 140 L168 146 L174 198 Q 174 206, 170 208
               L 158 208 Q 154 206, 154 198 L 150 148 L 154 140"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1"
            filter="url(#glow)"
          />
          <ellipse cx="164" cy="216" rx="10" ry="6"
            fill="rgba(15,8,4,0.6)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.4})`}
            strokeWidth="0.8"
          />
          <path
            d="M154 222 L152 270 Q 152 278, 156 280
               L 172 280 Q 176 278, 176 270 L 174 222 Z"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1"
            filter="url(#glow)"
          />
          <path
            d="M156 280 L154 296 Q 156 302, 162 302
               L 168 302 Q 174 300, 172 294 L 172 280"
            fill="rgba(15,8,4,0.8)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.3})`}
            strokeWidth="0.8"
          />

          {/* ===== LEFT LEG ===== */}
          {/* Thigh */}
          <path
            d="M68 274 L62 280 L56 350 Q 56 358, 60 360
               L 82 360 Q 86 358, 86 350 L 90 280 L 86 274"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1.2"
            filter="url(#glow)"
          />
          {/* Knee */}
          <ellipse cx="73" cy="368" rx="12" ry="7"
            fill="rgba(15,8,4,0.6)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.4})`}
            strokeWidth="0.8"
          />
          {/* Shin */}
          <path
            d="M60 375 L58 435 Q 58 443, 62 445
               L 84 445 Q 88 443, 86 435 L 84 375 Z"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1.2"
            filter="url(#glow)"
          />
          {/* Boot */}
          <path
            d="M58 445 L54 460 Q 52 470, 58 472
               L 86 472 Q 92 470, 90 462 L 88 445"
            fill="rgba(15,8,4,0.9)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.35})`}
            strokeWidth="1"
          />

          {/* ===== RIGHT LEG ===== */}
          <path
            d="M114 274 L110 280 L114 350 Q 114 358, 118 360
               L 140 360 Q 144 358, 144 350 L 138 280 L 132 274"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1.2"
            filter="url(#glow)"
          />
          <ellipse cx="129" cy="368" rx="12" ry="7"
            fill="rgba(15,8,4,0.6)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.4})`}
            strokeWidth="0.8"
          />
          <path
            d="M118 375 L116 435 Q 116 443, 120 445
               L 140 445 Q 144 443, 142 435 L 140 375 Z"
            fill="rgba(15,8,4,0.85)"
            stroke={edgeColor}
            strokeWidth="1.2"
            filter="url(#glow)"
          />
          <path
            d="M116 445 L112 460 Q 110 470, 116 472
               L 144 472 Q 150 470, 148 462 L 144 445"
            fill="rgba(15,8,4,0.9)"
            stroke={`rgba(255,170,50,${bodyGlow * 0.35})`}
            strokeWidth="1"
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
          <div className="text-3xl font-bold text-amber-400 font-mono leading-none">{bodyshotPct.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">of Hits</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em] mt-0.5 font-semibold">Body Shots</div>
        </div>
      </div>
    </div>
  );
};

export default BodyDiagram;
