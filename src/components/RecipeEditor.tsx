import React from 'react';
import type { SeparationInfo } from '../types';

interface RecipeEditorProps {
  separation: SeparationInfo;
  onRecipeChange: (name: string, recipe: [number, number, number, number]) => void;
}

export const RecipeEditor: React.FC<RecipeEditorProps> = ({ separation, onRecipeChange }) => {
  const labels = ['C', 'M', 'Y', 'K'];
  const colors = ['#00AEEF', '#EC008C', '#FFF200', '#231F20'];

  const handleChange = (index: number, value: number) => {
    const newRecipe = [...separation.cmykRecipe] as [number, number, number, number];
    newRecipe[index] = value;
    onRecipeChange(separation.name, newRecipe);
  };

  return (
    <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: separation.displayColor }}
        />
        <span className="text-sm font-medium text-white">{separation.name}</span>
        <span className="text-xs text-slate-500 ml-auto">
          {separation.kind === 'tech' ? '🔧 Technical' : '🎨 Spot Color'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {labels.map((label, idx) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <label className="text-xs font-bold" style={{ color: colors[idx] }}>
              {label}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={separation.cmykRecipe[idx]}
              onChange={(e) => handleChange(idx, Number(e.target.value))}
              className="w-full h-1.5 accent-cyan-500"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={Math.round(separation.cmykRecipe[idx])}
              onChange={(e) => handleChange(idx, Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-full text-center text-xs bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-white"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
