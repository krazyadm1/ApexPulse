import React from 'react';
import { MatchRecord } from '../../shared/types';
import { LEGENDS } from '../../shared/legend-map';

interface PostMatchSummaryProps {
  match: MatchRecord;
  onDismiss: () => void;
}

const PostMatchSummary: React.FC<PostMatchSummaryProps> = ({ match, onDismiss }) => {
  const isWin = match.placement === 1;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-apex-navy border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      <div className={`px-4 py-2 flex items-center justify-between ${isWin ? 'bg-yellow-500/20' : 'bg-apex-cyan/10'}`}>
        <span className={`text-sm font-bold ${isWin ? 'text-yellow-400' : 'text-apex-cyan'}`}>
          {isWin ? 'CHAMPION!' : 'Match Complete'}
        </span>
        <button onClick={onDismiss} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-xs">
            {LEGENDS[match.legend]?.displayName ?? match.legend} &bull; {match.mapName}
          </span>
          <span className={`font-bold text-lg ${isWin ? 'text-yellow-400' : 'text-apex-cyan'}`}>
            #{match.placement || '?'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-lg py-2">
            <div className="text-white font-bold text-lg">{match.kills}</div>
            <div className="text-white/40 text-[10px] uppercase">Kills</div>
          </div>
          <div className="bg-white/5 rounded-lg py-2">
            <div className="text-white font-bold text-lg">{match.damage.toLocaleString()}</div>
            <div className="text-white/40 text-[10px] uppercase">Damage</div>
          </div>
          <div className="bg-white/5 rounded-lg py-2">
            <div className="text-white font-bold text-lg">{match.assists}</div>
            <div className="text-white/40 text-[10px] uppercase">Assists</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostMatchSummary;
