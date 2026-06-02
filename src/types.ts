export interface SeparationInfo {
  name: string;
  kind: 'process' | 'spot' | 'tech';
  displayColor: string;
  cmykRecipe: [number, number, number, number]; // 0-100 range
}

export interface PlateData {
  name: string;
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type ViewMode = 'composite' | 'plate';

export interface AppState {
  fileLoaded: boolean;
  fileName: string;
  pageCount: number;
  currentPage: number;
  dpi: number;
  separations: SeparationInfo[];
  enabledChannels: Record<string, boolean>;
  imageWidth: number;
  imageHeight: number;
}
