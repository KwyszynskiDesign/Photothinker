import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploaderProps {
  onFileLoad: (data: ArrayBuffer, fileName: string) => void;
  isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileLoad, isLoading }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = () => onFileLoad(reader.result as ArrayBuffer, file.name);
        reader.readAsArrayBuffer(file);
      }
    },
    [onFileLoad]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => onFileLoad(reader.result as ArrayBuffer, file.name);
        reader.readAsArrayBuffer(file);
      }
    },
    [onFileLoad]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-cyan-500 transition-colors cursor-pointer bg-slate-800/50"
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleChange}
        className="hidden"
        id="pdf-upload"
        disabled={isLoading}
      />
      <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-4">
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
            <p className="text-slate-300 text-lg">Processing PDF...</p>
          </>
        ) : (
          <>
            <div className="bg-slate-700 rounded-full p-4">
              <Upload className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <p className="text-white text-lg font-medium">Drop a PDF file here or click to browse</p>
              <p className="text-slate-400 text-sm mt-1">Supports PDF/AI files with spot colors and separations</p>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-xs mt-2">
              <FileText className="w-4 h-4" />
              <span>.pdf files</span>
            </div>
          </>
        )}
      </label>
    </div>
  );
};
