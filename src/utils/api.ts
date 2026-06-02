/**
 * API client for RIP Preview Server v3
 * Updated with Halftone support
 */

// Auto-detect API base URL
function getApiBase(): string {
  const loc = window.location;
  if (loc.port === '5000') {
    return '/api';
  }
  return 'http://localhost:5000/api';
}

const API_BASE = getApiBase();

// ============================================================================
// TYPY DANYCH
// ============================================================================

export interface ServerStatus {
  status: string;
  version: string;
  pymupdf_version: string;
  python_version: string;
  features: string[];
}

export interface PageInfo {
  index: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SeparationInfo {
  name: string;
  kind: 'process' | 'spot' | 'tech';
  cmykRecipe: [number, number, number, number];
  displayColor: string;
  halftoneAngle?: number;
}

export interface CoverageDetailed {
  total: number;
  covered: number;
  percentage: number;
  ranges: {
    "0-10%": number;
    "10-30%": number;
    "30-70%": number;
    "70-100%": number;
  };
}

export interface ChannelData {
  image?: string;           // continuous tone
  halftone?: string;        // halftone version
  coverage: number;
  coverageDetailed?: CoverageDetailed;
  kind?: 'process' | 'spot' | 'tech';
  cmykRecipe?: [number, number, number, number];
  displayColor?: string;
}

export interface AnalyzeResult {
  success: boolean;
  filename: string;
  pageCount: number;
  pages: PageInfo[];
  separations: SeparationInfo[];
  processColors: SeparationInfo[];
  colorAnalysis?: {
    cmyk: string[];
    spot: string[];
    rgb: string[];
    lab: string[];
    named: string[];
  };
  error?: string;
}

export interface RenderResult {
  success: boolean;
  width: number;
  height: number;
  dpi: number;
  mode: 'continuous' | 'halftone' | 'both';
  halftoneType: 'am' | 'fs' | 'ordered';
  cellSize: number;
  composite: string;
  channels: Record<string, ChannelData>;
  error?: string;
}

// ============================================================================
// FUNKCJE API
// ============================================================================

/**
 * Check if server is running
 */
export async function checkServerHealth(): Promise<ServerStatus | null> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Analyze PDF file - extracts separations and colors
 */
export async function analyzePdf(file: File): Promise<AnalyzeResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(error.error || 'Failed to analyze PDF');
  }

  return response.json();
}

/**
 * Render page with channel separation
 * 
 * @param file - PDF file
 * @param page - Page index (0-based)
 * @param dpi - Resolution
 * @param mode - 'continuous' | 'halftone' | 'both'
 * @param halftoneType - 'am' (AM Halftone) | 'fs' (Floyd-Steinberg) | 'ordered' (Bayer)
 * @param cellSize - Halftone cell size (4-16)
 */
export async function renderPage(
  file: File,
  page: number,
  dpi: number,
  mode: 'continuous' | 'halftone' | 'both' = 'both',
  halftoneType: 'am' | 'fs' | 'ordered' = 'am',
  cellSize: number = 8
): Promise<RenderResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page', page.toString());
  formData.append('dpi', dpi.toString());
  formData.append('mode', mode);
  formData.append('halftone_type', halftoneType);
  formData.append('cell_size', cellSize.toString());

  const response = await fetch(`${API_BASE}/render`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(error.error || 'Failed to render page');
  }

  return response.json();
}

/**
 * Find closest Pantone color
 */
export async function matchSpotColor(
  rgb?: [number, number, number],
  cmyk?: [number, number, number, number]
): Promise<{
  match: string;
  deltaE: number;
  cmyk: [number, number, number, number];
  inputLab: [number, number, number];
}> {
  const response = await fetch(`${API_BASE}/spot-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rgb, cmyk }),
  });

  if (!response.ok) {
    throw new Error('Failed to match spot color');
  }

  return response.json();
}

/**
 * Export single plate
 * 
 * @param file - PDF file
 * @param page - Page index
 * @param channel - Channel name
 * @param dpi - Resolution
 * @param format - 'png' | 'tiff'
 * @param halftone - Apply halftone
 * @param cellSize - Halftone cell size
 */
export async function exportPlate(
  file: File,
  page: number,
  channel: string,
  dpi: number,
  format: 'png' | 'tiff' = 'png',
  halftone: boolean = false,
  cellSize: number = 8
): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page', page.toString());
  formData.append('channel', channel);
  formData.append('dpi', dpi.toString());
  formData.append('format', format);
  formData.append('halftone', halftone.toString());
  formData.append('cell_size', cellSize.toString());

  const response = await fetch(`${API_BASE}/export-plate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(error.error || 'Failed to export plate');
  }

  return response.blob();
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}