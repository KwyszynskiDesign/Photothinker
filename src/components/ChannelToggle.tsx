import React from 'react';
import type { SeparationInfo } from '../types';
import { Eye, EyeOff, Layers, Scissors, Palette } from 'lucide-react';

interface ChannelToggleProps {
  channel: SeparationInfo;
  enabled: boolean;
  coverage: number;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}

export const ChannelToggle: React.FC<ChannelToggleProps> = ({
  channel,
  enabled,
  coverage,
  onToggle,
  onSelect,
  isSelected,
}) => {
  const kindIcon = {
    process: <Layers className="w-3.5 h-3.5" />,
    tech: <Scissors className="w-3.5 h-3.5" />,
    spot: <Palette className="w-3.5 h-3.5" />,
  };

  const kindLabel = {
    process: 'Process',
    tech: 'Technical',
    spot: 'Spot',
  };

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
        ${isSelected ? 'ring-2 ring-cyan-400 border-cyan-600 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}
      `}
      onClick={onSelect}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0"
        title={enabled ? 'Hide channel' : 'Show channel'}
      >
        {enabled ? (
          <Eye className="w-4 h-4 text-green-400" />
        ) : (
          <EyeOff className="w-4 h-4 text-slate-500" />
        )}
      </button>

      <div
        className="w-4 h-4 rounded-sm border border-white/20 shrink-0"
        style={{ backgroundColor: channel.displayColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium truncate">{channel.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {kindIcon[channel.kind]}
          <span>{kindLabel[channel.kind]}</span>
          <span className="text-slate-600">•</span>
          <span>{coverage.toFixed(1)}%</span>
        </div>
      </div>

      <div className="text-xs text-slate-500 font-mono">
        {channel.cmykRecipe.map((v) => Math.round(v)).join('/')}
      </div>
    </div>
  );
};
