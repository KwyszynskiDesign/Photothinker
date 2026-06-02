import * as pdfjsLib from 'pdfjs-dist';
import type { SeparationInfo } from '../types';
import { BLACKLIST_NAMES, TECH_HINTS, PANTONE_RECIPES } from '../constants';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs`;

function decodeHexEscapes(name: string): string {
  return name.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return '';
    }
  });
}

function classifyColor(name: string): 'tech' | 'spot' {
  const lower = name.toLowerCase();
  for (const hint of TECH_HINTS) {
    if (lower.includes(hint)) return 'tech';
  }
  return 'spot';
}

function getRecipeForName(name: string): [number, number, number, number] {
  const lower = name.toLowerCase().trim();

  // Direct lookup
  if (PANTONE_RECIPES[lower]) return [...PANTONE_RECIPES[lower]];

  // Try without trailing suffixes like C, U, M
  const withoutSuffix = lower.replace(/\s+[cum]$/, '');
  if (PANTONE_RECIPES[withoutSuffix]) return [...PANTONE_RECIPES[withoutSuffix]];

  // Try adding 'pantone' prefix
  if (!lower.startsWith('pantone')) {
    const withPrefix = `pantone ${lower}`;
    if (PANTONE_RECIPES[withPrefix]) return [...PANTONE_RECIPES[withPrefix]];
  }

  // Try extracting just the number
  const numMatch = lower.match(/(\d{2,4})/);
  if (numMatch) {
    const num = numMatch[1];
    const tryKey = `pantone ${num}`;
    if (PANTONE_RECIPES[tryKey]) return [...PANTONE_RECIPES[tryKey]];
    const tryKeyC = `pantone ${num} c`;
    if (PANTONE_RECIPES[tryKeyC]) return [...PANTONE_RECIPES[tryKeyC]];
  }

  // Default recipe based on kind
  const kind = classifyColor(name);
  if (kind === 'tech') {
    return [0, 100, 0, 0]; // Magenta for technical
  }
  return [100, 0, 100, 0]; // Purple default for unknown spots
}

function getDisplayColor(_name: string, recipe: [number, number, number, number]): string {
  const c = recipe[0] / 100;
  const m = recipe[1] / 100;
  const y = recipe[2] / 100;
  const k = recipe[3] / 100;

  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));

  return `rgb(${r}, ${g}, ${b})`;
}

function isBlacklisted(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (BLACKLIST_NAMES.has(lower)) return true;
  if (/^device(cmyk|rgb|gray|n)$/i.test(lower)) return true;
  if (/^icc/i.test(lower)) return true;
  if (/^cal(rgb|gray)$/i.test(lower)) return true;
  return false;
}

export async function loadPdf(data: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({
    data,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/cmaps/',
    cMapPacked: true,
  }).promise;
  return pdf;
}

/**
 * Extract separations by parsing PDF internal data
 */
export async function extractSeparations(
  pdf: pdfjsLib.PDFDocumentProxy
): Promise<SeparationInfo[]> {
  const results = new Map<string, SeparationInfo>();

  // Access internal PDF data through pdf.js internals
  try {
    // @ts-ignore - accessing internal API
    const pdfManager = pdf._pdfInfo;
    // @ts-ignore
    const transport = pdf._transport;
    
    if (transport && transport.commonObjs) {
      // Try to get color spaces from common objects
      const objs = transport.commonObjs;
      for (const key of Object.keys(objs._objs || {})) {
        try {
          const obj = objs._objs[key];
          if (obj && obj.data) {
            parseColorSpaceObj(obj.data, results);
          }
        } catch {
          // Skip
        }
      }
    }
  } catch {
    // Internal access failed, continue with other methods
  }

  // Parse each page for color spaces
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      
      // Get operator list and look for color space operations
      const opList = await page.getOperatorList();
      
      // OPS.setFillColorSpace = 36, OPS.setStrokeColorSpace = 37
      const CS_OPS = [36, 37];
      
      for (let j = 0; j < opList.fnArray.length; j++) {
        if (CS_OPS.includes(opList.fnArray[j])) {
          const args = opList.argsArray[j];
          if (args && args[0]) {
            parseColorSpaceArg(args[0], results);
          }
        }
      }

      // Also check args for any color space definitions
      for (const args of opList.argsArray) {
        if (Array.isArray(args)) {
          for (const arg of args) {
            parseColorSpaceArg(arg, results);
          }
        }
      }
    } catch {
      // Page parsing failed, continue
    }
  }

  return Array.from(results.values());
}

function parseColorSpaceArg(arg: any, results: Map<string, SeparationInfo>): void {
  if (!arg) return;

  // Handle Name objects
  if (typeof arg === 'object' && arg.name) {
    const name = decodeHexEscapes(arg.name);
    if (!isBlacklisted(name) && !isProcessColor(name)) {
      addSeparation(name, results);
    }
  }

  // Handle arrays (color space definitions)
  if (Array.isArray(arg)) {
    const csType = arg[0];
    const typeName = typeof csType === 'object' && csType?.name ? csType.name : csType;

    if (typeName === 'Separation' && arg.length >= 2) {
      const colorName = typeof arg[1] === 'object' && arg[1]?.name 
        ? arg[1].name 
        : String(arg[1] || '');
      const decoded = decodeHexEscapes(colorName);
      if (!isBlacklisted(decoded) && !isProcessColor(decoded)) {
        // Try to extract CMYK recipe from tint transform if available
        let recipe: [number, number, number, number] | null = null;
        if (arg.length >= 4 && Array.isArray(arg[3])) {
          recipe = extractRecipeFromFunction(arg[3]);
        }
        addSeparation(decoded, results, recipe);
      }
    }

    if (typeName === 'DeviceN' && Array.isArray(arg[1])) {
      for (const item of arg[1]) {
        const colorName = typeof item === 'object' && item?.name 
          ? item.name 
          : String(item || '');
        const decoded = decodeHexEscapes(colorName);
        if (!isBlacklisted(decoded) && !isProcessColor(decoded)) {
          addSeparation(decoded, results);
        }
      }
    }

    // Recurse into array elements
    for (const item of arg) {
      if (item && typeof item === 'object') {
        parseColorSpaceArg(item, results);
      }
    }
  }

  // Handle objects
  if (typeof arg === 'object' && !Array.isArray(arg)) {
    for (const key of Object.keys(arg)) {
      parseColorSpaceArg(arg[key], results);
    }
  }
}

function parseColorSpaceObj(obj: any, results: Map<string, SeparationInfo>): void {
  if (!obj) return;
  
  if (Array.isArray(obj)) {
    parseColorSpaceArg(obj, results);
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      try {
        parseColorSpaceObj(obj[key], results);
      } catch {
        // Skip
      }
    }
  }
}

function isProcessColor(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return ['cyan', 'magenta', 'yellow', 'black', 'c', 'm', 'y', 'k'].includes(lower);
}

function addSeparation(
  name: string, 
  results: Map<string, SeparationInfo>,
  recipe?: [number, number, number, number] | null
): void {
  if (results.has(name)) return;
  
  const finalRecipe = recipe || getRecipeForName(name);
  const kind = classifyColor(name);
  
  results.set(name, {
    name,
    kind,
    displayColor: getDisplayColor(name, finalRecipe),
    cmykRecipe: finalRecipe,
  });
}

function extractRecipeFromFunction(fnArray: any[]): [number, number, number, number] | null {
  // Try to extract CMYK values from PostScript function
  // Common pattern: { dup ... mul exch ... } or simple constants
  try {
    // Look for numeric constants that could be CMYK values
    const nums: number[] = [];
    for (const item of fnArray) {
      if (typeof item === 'number' && item >= 0 && item <= 1) {
        nums.push(item);
      }
    }
    if (nums.length >= 4) {
      return [
        Math.round(nums[0] * 100),
        Math.round(nums[1] * 100),
        Math.round(nums[2] * 100),
        Math.round(nums[3] * 100),
      ];
    }
  } catch {
    // Failed to parse
  }
  return null;
}

export async function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  scale: number
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return { canvas, width: viewport.width, height: viewport.height };
}

export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert RGB to CMYK - proper conversion
 */
export function rgbToCmykChannels(
  imageData: ImageData
): {
  cyan: Uint8ClampedArray;
  magenta: Uint8ClampedArray;
  yellow: Uint8ClampedArray;
  black: Uint8ClampedArray;
} {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const cyan = new Uint8ClampedArray(pixelCount);
  const magenta = new Uint8ClampedArray(pixelCount);
  const yellow = new Uint8ClampedArray(pixelCount);
  const black = new Uint8ClampedArray(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;

    // UCR/GCR style conversion
    const k = 1 - Math.max(r, g, b);
    
    if (k >= 0.9999) {
      // Pure black
      cyan[i] = 0;
      magenta[i] = 0;
      yellow[i] = 0;
      black[i] = 255;
    } else {
      const invK = 1 / (1 - k);
      cyan[i] = Math.round(Math.max(0, Math.min(1, (1 - r - k) * invK)) * 255);
      magenta[i] = Math.round(Math.max(0, Math.min(1, (1 - g - k) * invK)) * 255);
      yellow[i] = Math.round(Math.max(0, Math.min(1, (1 - b - k) * invK)) * 255);
      black[i] = Math.round(k * 255);
    }
  }

  return { cyan, magenta, yellow, black };
}
