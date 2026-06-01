import React from 'react';

interface BodyDiagramProps {
  headshotPct: number;
  bodyshotPct: number;
}

const BodyDiagram: React.FC<BodyDiagramProps> = ({ headshotPct, bodyshotPct }) => {
  const headColor = `rgba(0,229,255,${Math.max(headshotPct / 100, 0.2)})`;
  const bodyColor = `rgba(0,200,200,${Math.max(bodyshotPct / 100, 0.2)})`;
  const headStroke = 'rgba(0,229,255,0.4)';
  const bodyStroke = 'rgba(0,200,200,0.3)';
  const hazardFill = 'rgba(200,200,0,0.3)';

  return (
    <div className="flex items-center justify-center gap-10">
      <div className="relative w-28">
        <svg viewBox="0 0 200 480" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">

          {/* ===== HEAD — Motorcycle helmet shape ===== */}
          {/* Main helmet dome */}
          <path
            d="M100 8
               C 68 8, 54 28, 54 50
               C 54 62, 56 70, 62 76
               L 62 82 Q 62 88, 70 90
               L 130 90 Q 138 88, 138 82
               L 138 76
               C 144 70, 146 62, 146 50
               C 146 28, 132 8, 100 8 Z"
            fill={headColor}
            stroke={headStroke}
            strokeWidth="1.5"
          />
          {/* Visor slit — horizontal band across the face */}
          <path
            d="M60 48 L140 48 L142 56 L58 56 Z"
            fill="rgba(0,0,0,0.4)"
            stroke={headStroke}
            strokeWidth="0.8"
          />
          {/* Chin guard bottom edge */}
          <path
            d="M70 90 L70 94 Q 72 100, 100 102 Q 128 100, 130 94 L130 90"
            fill={headColor}
            stroke={headStroke}
            strokeWidth="1"
          />

          {/* ===== NECK ===== */}
          <rect x="88" y="100" width="24" height="14" rx="3"
            fill={bodyColor} stroke={bodyStroke} strokeWidth="1"
          />

          {/* ===== SHOULDER ARMOR PLATES ===== */}
          {/* Left shoulder plate — wide angular shape */}
          <path
            d="M88 114 L60 118 L30 126 Q 24 130, 26 138
               L 30 146 L 60 140 L 84 134 Z"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.5"
          />
          {/* Right shoulder plate */}
          <path
            d="M112 114 L140 118 L170 126 Q 176 130, 174 138
               L 170 146 L 140 140 L 116 134 Z"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.5"
          />
          {/* Left shoulder hazard diamond */}
          <polygon
            points="48,132 56,126 64,132 56,138"
            fill={hazardFill}
            stroke="rgba(200,200,0,0.5)"
            strokeWidth="0.8"
          />
          {/* Right shoulder hazard diamond */}
          <polygon
            points="136,132 144,126 152,132 144,138"
            fill={hazardFill}
            stroke="rgba(200,200,0,0.5)"
            strokeWidth="0.8"
          />

          {/* ===== CHEST / TORSO — segmented armor ===== */}
          {/* Main chest plate */}
          <path
            d="M68 134 L68 240 Q 70 252, 80 254
               L 120 254 Q 130 252, 132 240
               L 132 134 Z"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.5"
          />
          {/* Center vertical line dividing left/right chest */}
          <line x1="100" y1="134" x2="100" y2="254"
            stroke={bodyStroke} strokeWidth="1.2"
          />
          {/* Upper chest horizontal segment line */}
          <line x1="68" y1="170" x2="132" y2="170"
            stroke={bodyStroke} strokeWidth="0.8"
          />
          {/* Mid chest horizontal segment line */}
          <line x1="68" y1="204" x2="132" y2="204"
            stroke={bodyStroke} strokeWidth="0.8"
          />

          {/* ===== BELT / WAIST ARMOR BAND ===== */}
          <rect x="64" y="250" width="72" height="16" rx="3"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.5"
          />
          {/* Belt center buckle detail */}
          <rect x="92" y="253" width="16" height="10" rx="2"
            fill="rgba(0,200,200,0.15)"
            stroke={bodyStroke}
            strokeWidth="0.8"
          />

          {/* ===== LEFT ARM ===== */}
          {/* Left upper arm cylinder */}
          <path
            d="M30 146 L26 148 L22 192 Q 22 198, 26 200
               L 38 200 Q 42 198, 42 192
               L 46 148 L 42 146"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Left elbow joint gap */}
          <ellipse cx="30" cy="208" rx="10" ry="6"
            fill="rgba(0,200,200,0.1)"
            stroke={bodyStroke}
            strokeWidth="0.8"
          />
          {/* Left forearm armor plate */}
          <path
            d="M20 214 L18 256 Q 18 264, 22 266
               L 38 266 Q 42 264, 42 256
               L 40 214 Z"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Left hand */}
          <path
            d="M22 266 L20 280 Q 20 286, 24 288
               L 36 288 Q 40 286, 38 280
               L 38 266"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1"
          />

          {/* ===== RIGHT ARM ===== */}
          {/* Right upper arm cylinder */}
          <path
            d="M170 146 L174 148 L178 192 Q 178 198, 174 200
               L 162 200 Q 158 198, 158 192
               L 154 148 L 158 146"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Right elbow joint gap */}
          <ellipse cx="170" cy="208" rx="10" ry="6"
            fill="rgba(0,200,200,0.1)"
            stroke={bodyStroke}
            strokeWidth="0.8"
          />
          {/* Right forearm armor plate */}
          <path
            d="M160 214 L158 256 Q 158 264, 162 266
               L 178 266 Q 182 264, 182 256
               L 180 214 Z"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Right hand */}
          <path
            d="M162 266 L160 280 Q 160 286, 164 288
               L 176 288 Q 180 286, 178 280
               L 178 266"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1"
          />

          {/* ===== LEFT LEG ===== */}
          {/* Left thigh armor plate */}
          <path
            d="M68 266 L64 268 L58 340 Q 58 348, 62 350
               L 84 350 Q 88 348, 88 340
               L 92 268 L 88 266"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Left thigh hazard diamond */}
          <polygon
            points="75,296 81,288 87,296 81,304"
            fill={hazardFill}
            stroke="rgba(200,200,0,0.5)"
            strokeWidth="0.8"
          />
          {/* Left knee joint gap */}
          <ellipse cx="75" cy="358" rx="12" ry="7"
            fill="rgba(0,200,200,0.1)"
            stroke={bodyStroke}
            strokeWidth="0.8"
          />
          {/* Left shin/calf armor */}
          <path
            d="M62 365 L60 420 Q 60 428, 64 430
               L 86 430 Q 90 428, 88 420
               L 86 365 Z"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Left boot */}
          <path
            d="M58 430 L54 448 Q 52 458, 58 462
               L 86 462 Q 94 460, 92 450
               L 90 430"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />

          {/* ===== RIGHT LEG ===== */}
          {/* Right thigh armor plate */}
          <path
            d="M112 266 L108 268 L112 340 Q 112 348, 116 350
               L 138 350 Q 142 348, 142 340
               L 136 268 L 132 266"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Right thigh hazard diamond */}
          <polygon
            points="119,296 125,288 131,296 125,304"
            fill={hazardFill}
            stroke="rgba(200,200,0,0.5)"
            strokeWidth="0.8"
          />
          {/* Right knee joint gap */}
          <ellipse cx="125" cy="358" rx="12" ry="7"
            fill="rgba(0,200,200,0.1)"
            stroke={bodyStroke}
            strokeWidth="0.8"
          />
          {/* Right shin/calf armor */}
          <path
            d="M114 365 L112 420 Q 112 428, 116 430
               L 138 430 Q 142 428, 140 420
               L 138 365 Z"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
          />
          {/* Right boot */}
          <path
            d="M110 430 L108 448 Q 106 458, 112 462
               L 140 462 Q 148 460, 146 450
               L 142 430"
            fill={bodyColor}
            stroke={bodyStroke}
            strokeWidth="1.2"
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
