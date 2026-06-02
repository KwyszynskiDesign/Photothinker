import React from 'react';

interface HalftoneSettingsProps {
  cellSize: number;
  angle: number;
  minDot: number;
  isTech: boolean;
  onCellSizeChange: (v: number) => void;
  onAngleChange: (v: number) => void;
  onMinDotChange: (v: number) => void;
}

export const HalftoneSettings: React.FC<HalftoneSettingsProps> = ({
  cellSize,
  angle,
  minDot,
  isTech,
  onCellSizeChange,
  onAngleChange,
  onMinDotChange,
}) => {
  if (isTech) {
    return (
      <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg px-4 py-2 inline-flex items-center gap-2">
        <span className="text-emerald-400 text-sm font-medium">🔧 Technical Layer</span>
        <span className="text-emerald-300/60 text-xs">
          — Halftone disabled. Rendered as solid (1-bit) output.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 whitespace-nowrap">
          Angle: <span className="text-white font-mono">{angle}°</span>
        </label>
        <input
          type="range"
          min="0"
          max="90"
          value={angle}
          onChange={(e) => onAngleChange(Number(e.target.value))}
          className="w-24 h-1.5 accent-cyan-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 whitespace-nowrap">
          Cell: <span className="text-white font-mono">{cellSize}px</span>
        </label>
        <input
          type="range"
          min="2"
          max="20"
          value={cellSize}
          onChange={(e) => onCellSizeChange(Number(e.target.value))}
          className="w-24 h-1.5 accent-cyan-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 whitespace-nowrap">
          Min Dot: <span className="text-white font-mono">{minDot.toFixed(1)}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.5"
          value={minDot}
          onChange={(e) => onMinDotChange(Number(e.target.value))}
          className="w-24 h-1.5 accent-cyan-500"
        />
      </div>
    </div>
  );
};
