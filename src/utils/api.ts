/**
 * API client for RIP Preview Server
 */

// Auto-detect API base URL
// If served from Flask server (localhost:5000), use relative path
// If opened as file:// or from another server, connect to localhost:5000
function getApiBase(): string {
  const loc = window.location;
  if (loc.port === '5000') {
    return '/api'; // Same server
  }
  return 'http://localhost:5000/api';
}

const API_BASE = getApiBase();

export interface ServerStatus {
  status: string;
  pymupdf_version: string;
  capabilities: string[];
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
}

export interface AnalyzeResult {
  success: boolean;
  filename: string;
  pageCount: number;
  pages: PageInfo[];
  separations: SeparationInfo[];
  processColors: SeparationInfo[];
  error?: string;
}

export interface ChannelData {
  image: string; // base64
  coverage: number;
}

export interface RenderResult {
  success: boolean;
  width: number;
  height: number;
  dpi: number;
  composite: string; // base64
  channels: Record<string, ChannelData>;
  error?: string;
}

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
 * Analyze PDF file
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
 */
export async function renderPage(
  file: File,
  page: number,
  dpi: number
): Promise<RenderResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page', page.toString());
  formData.append('dpi', dpi.toString());

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
 * Export single plate
 */
export async function exportPlate(
  file: File,
  page: number,
  channel: string,
  dpi: number,
  format: 'png' | 'tiff' = 'png'
): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page', page.toString());
  formData.append('channel', channel);
  formData.append('dpi', dpi.toString());
  formData.append('format', format);

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
