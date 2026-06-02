/**
 * Raw PDF Parser - parses PDF binary to extract separation info
 * This bypasses pdf.js rendering limitations by reading the raw PDF structure
 * 
 * PDF color spaces we're looking for:
 * - /Separation /ColorName /AlternateSpace tintTransform
 * - /DeviceN [/Color1 /Color2 ...] /AlternateSpace attributes tintTransform
 * 
 * Common patterns in real PDFs:
 * - [/Separation /PANTONE#20185#20C /DeviceCMYK ...]
 * - /CS0 [/Separation /Spot1 /DeviceCMYK {...}]
 * - /DeviceN [/Cyan /Magenta /Yellow /Black /PANTONE#20Reflex#20Blue#20C] /DeviceCMYK
 */

import type { SeparationInfo } from '../types';
import { BLACKLIST_NAMES, TECH_HINTS, PANTONE_RECIPES } from '../constants';

// Types for internal parsing (used for future expansion)
// interface ParsedSeparation {
//   name: string;
//   alternateSpace: string;
//   tintTransform: number[] | null;
// }

function decodeHexEscapes(name: string): string {
  return name.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return '';
    }
  });
}

function decodePdfString(str: string): string {
  // Remove leading/trailing slashes and decode hex escapes
  let result = str.startsWith('/') ? str.slice(1) : str;
  result = decodeHexEscapes(result);
  return result;
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

  if (PANTONE_RECIPES[lower]) return [...PANTONE_RECIPES[lower]];

  const withoutSuffix = lower.replace(/\s+[cum]$/, '');
  if (PANTONE_RECIPES[withoutSuffix]) return [...PANTONE_RECIPES[withoutSuffix]];

  if (!lower.startsWith('pantone')) {
    const withPrefix = `pantone ${lower}`;
    if (PANTONE_RECIPES[withPrefix]) return [...PANTONE_RECIPES[withPrefix]];
  }

  const numMatch = lower.match(/(\d{2,4})/);
  if (numMatch) {
    const num = numMatch[1];
    const tryKey = `pantone ${num}`;
    if (PANTONE_RECIPES[tryKey]) return [...PANTONE_RECIPES[tryKey]];
    const tryKeyC = `pantone ${num} c`;
    if (PANTONE_RECIPES[tryKeyC]) return [...PANTONE_RECIPES[tryKeyC]];
  }

  const kind = classifyColor(name);
  if (kind === 'tech') {
    return [0, 100, 0, 0];
  }
  return [100, 0, 100, 0];
}

function getDisplayColor(recipe: [number, number, number, number]): string {
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
  if (/^device(cmyk|rgb|gray|n)?$/i.test(lower)) return true;
  if (/^icc/i.test(lower)) return true;
  if (/^cal(rgb|gray)$/i.test(lower)) return true;
  if (/^(indexed|pattern|lab)$/i.test(lower)) return true;
  return false;
}

function isProcessColor(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return ['cyan', 'magenta', 'yellow', 'black', 'c', 'm', 'y', 'k', 'white', 'none', 'all'].includes(lower);
}

/**
 * Parse raw PDF bytes to extract separation definitions
 */
export function parseRawPdfSeparations(pdfBytes: ArrayBuffer): SeparationInfo[] {
  const text = arrayBufferToString(pdfBytes);
  const results = new Map<string, SeparationInfo>();

  // Find all /Separation definitions
  // Pattern: /Separation /ColorName /AlternateSpace tintTransform
  const sepRegex = /\/Separation\s*\/([^\s\[\]<>\/()]+)/g;
  let match;
  
  while ((match = sepRegex.exec(text)) !== null) {
    const rawName = match[1];
    const name = decodePdfString(rawName);
    
    if (!isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
      const kind = classifyColor(name);
      const recipe = getRecipeForName(name);
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  // Find all /DeviceN definitions
  // Pattern: /DeviceN [/Color1 /Color2 ...] /AlternateSpace
  const deviceNRegex = /\/DeviceN\s*\[\s*([^\]]+)\]/g;
  
  while ((match = deviceNRegex.exec(text)) !== null) {
    const colorList = match[1];
    // Extract individual color names
    const colorNames = colorList.match(/\/([^\s\[\]<>\/()]+)/g) || [];
    
    for (const rawName of colorNames) {
      const name = decodePdfString(rawName);
      
      if (!isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
        const kind = classifyColor(name);
        const recipe = getRecipeForName(name);
        results.set(name, {
          name,
          kind,
          displayColor: getDisplayColor(recipe),
          cmykRecipe: recipe,
        });
      }
    }
  }

  // Also look for spot colors in more complex patterns
  // /CS0 [/Separation /PANTONE#20185#20C /DeviceCMYK ...]
  const csDefRegex = /\[\s*\/Separation\s+\/([^\s\[\]<>\/()]+)\s+\/(\w+)/g;
  
  while ((match = csDefRegex.exec(text)) !== null) {
    const rawName = match[1];
    // const alternateSpace = match[2]; // Could be used for alternate space detection
    const name = decodePdfString(rawName);
    
    if (!isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
      const kind = classifyColor(name);
      let recipe = getRecipeForName(name);
      
      // Try to find CMYK values after this definition
      const afterMatch = text.slice(match.index, match.index + 500);
      const cmykValues = extractCmykFromContext(afterMatch);
      if (cmykValues) {
        recipe = cmykValues;
      }
      
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  // Additional pattern: Look for color names defined as /Name in ColorSpace context
  // Sometimes PDFs have patterns like: /ColorSpace << /Cs1 [/Separation /SpotColor ...
  const altSepRegex = /\[\s*\/Separation\s+([^\s\[\]]+)\s+\/Device/gi;
  while ((match = altSepRegex.exec(text)) !== null) {
    const rawName = match[1];
    const name = decodePdfString(rawName);
    
    if (!isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
      const kind = classifyColor(name);
      const recipe = getRecipeForName(name);
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  // Pattern for parenthesized names: /Separation (Color Name) /DeviceCMYK
  const parenSepRegex = /\/Separation\s*\(([^)]+)\)/g;
  while ((match = parenSepRegex.exec(text)) !== null) {
    const name = match[1].trim();
    
    if (!isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
      const kind = classifyColor(name);
      const recipe = getRecipeForName(name);
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  // Look for all PANTONE references specifically
  const pantoneRegex = /PANTONE[#%]?[0-9A-Fa-f]*\s*\d+[#%]?[0-9A-Fa-f]*\s*[CUMcum]?/gi;
  while ((match = pantoneRegex.exec(text)) !== null) {
    let name = decodeHexEscapes(match[0].replace(/%([0-9A-Fa-f]{2})/g, '#$1'));
    name = name.replace(/\s+/g, ' ').trim();
    
    if (!results.has(name) && name.length > 5) {
      const kind = classifyColor(name);
      const recipe = getRecipeForName(name);
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  // Look for common spot color keywords that might be custom names
  const spotKeywords = ['spot', 'sonderfarbe', 'vollton', 'schmuck', 'special'];
  for (const keyword of spotKeywords) {
    const keywordRegex = new RegExp(`\\/(${keyword}[^\\s\\[\\]<>\\/()]*[^\\s\\[\\]<>\\/()]+)`, 'gi');
    while ((match = keywordRegex.exec(text)) !== null) {
      const name = decodePdfString(match[1]);
      
      if (!isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
        const kind = classifyColor(name);
        const recipe = getRecipeForName(name);
        results.set(name, {
          name,
          kind,
          displayColor: getDisplayColor(recipe),
          cmykRecipe: recipe,
        });
      }
    }
  }

  // Look for HKS colors (German color system)
  const hksRegex = /HKS\s*\d+\s*[NEZKM]?/gi;
  while ((match = hksRegex.exec(text)) !== null) {
    let name = match[0].replace(/\s+/g, ' ').trim();
    
    if (!results.has(name)) {
      const kind = 'spot';
      const recipe: [number, number, number, number] = [100, 0, 100, 0]; // Default
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  // Look for TOYO, DIC, FOCOLTONE color systems
  const colorSystemRegex = /(TOYO|DIC|FOCOLTONE)\s*\d+/gi;
  while ((match = colorSystemRegex.exec(text)) !== null) {
    let name = match[0].replace(/\s+/g, ' ').trim();
    
    if (!results.has(name)) {
      const kind = 'spot';
      const recipe: [number, number, number, number] = [100, 0, 100, 0];
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  // Look for color names after /N or /CS entries that aren't standard process
  const csNameRegex = /\/(?:CS|N)\d*\s+(?:\d+\s+\d+\s+R|<<[^>]*\/Name\s*\/([^\s\/>]+))/g;
  while ((match = csNameRegex.exec(text)) !== null) {
    if (match[1]) {
      const name = decodePdfString(match[1]);
      if (!isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
        const kind = classifyColor(name);
        const recipe = getRecipeForName(name);
        results.set(name, {
          name,
          kind,
          displayColor: getDisplayColor(recipe),
          cmykRecipe: recipe,
        });
      }
    }
  }

  // Debug: also look for any /Name entries in the PDF
  const nameEntryRegex = /\/Name\s*\/([^\s\/<>]+)/g;
  while ((match = nameEntryRegex.exec(text)) !== null) {
    const name = decodePdfString(match[1]);
    // Only add if it looks like a color name (contains color-related terms)
    const colorTerms = ['color', 'colour', 'ink', 'pantone', 'spot', 'cmyk', 'rgb', 'gray', 'grey', 
                        'red', 'green', 'blue', 'orange', 'purple', 'pink', 'gold', 'silver', 'bronze'];
    const lowerName = name.toLowerCase();
    if (colorTerms.some(t => lowerName.includes(t)) && !isBlacklisted(name) && !isProcessColor(name) && !results.has(name)) {
      const kind = classifyColor(name);
      const recipe = getRecipeForName(name);
      results.set(name, {
        name,
        kind,
        displayColor: getDisplayColor(recipe),
        cmykRecipe: recipe,
      });
    }
  }

  console.log(`[PDF Parser] Found ${results.size} separations:`, Array.from(results.keys()));

  return Array.from(results.values());
}

/**
 * Try to extract CMYK values from PDF context
 */
function extractCmykFromContext(context: string): [number, number, number, number] | null {
  // Look for patterns like: /DeviceCMYK ... 0.1 0.2 0.3 0.4
  // or function arrays with CMYK values
  
  // Simple pattern: four consecutive decimals between 0 and 1
  const numPattern = /(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)(?:\s+[kcmyKCMY]|\s*\])/;
  const match = context.match(numPattern);
  
  if (match) {
    const vals = [
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
      parseFloat(match[4])
    ];
    
    // Check if values are in valid range
    if (vals.every(v => v >= 0 && v <= 1)) {
      return [
        Math.round(vals[0] * 100),
        Math.round(vals[1] * 100),
        Math.round(vals[2] * 100),
        Math.round(vals[3] * 100)
      ];
    }
  }
  
  return null;
}

/**
 * Convert ArrayBuffer to string (handling binary PDF)
 */
function arrayBufferToString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  
  // Process in chunks to avoid stack overflow
  const chunkSize = 65536;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      result += String.fromCharCode(chunk[j]);
    }
  }
  
  return result;
}

/**
 * Enhanced separation finder that looks for all color definitions in PDF
 */
export function findAllColorDefinitions(pdfText: string): Map<string, any> {
  const colors = new Map<string, any>();
  
  // Pattern 1: Direct /Separation
  let regex = /\/Separation\s*\/([^\s\[\]<>\/()]+)/g;
  let match;
  while ((match = regex.exec(pdfText)) !== null) {
    const name = decodePdfString(match[1]);
    if (!isBlacklisted(name) && !isProcessColor(name)) {
      colors.set(name, { type: 'Separation', raw: match[0] });
    }
  }
  
  // Pattern 2: /DeviceN array
  regex = /\/DeviceN\s*\[\s*([^\]]+)\]/g;
  while ((match = regex.exec(pdfText)) !== null) {
    const colorList = match[1];
    const names = colorList.match(/\/([^\s\[\]<>\/()]+)/g) || [];
    for (const rawName of names) {
      const name = decodePdfString(rawName);
      if (!isBlacklisted(name) && !isProcessColor(name)) {
        colors.set(name, { type: 'DeviceN', raw: match[0] });
      }
    }
  }
  
  // Pattern 3: Named color spaces in resources
  regex = /\/(\w+)\s*\[\s*\/Separation\s+\/([^\s\[\]<>\/()]+)/g;
  while ((match = regex.exec(pdfText)) !== null) {
    const name = decodePdfString(match[2]);
    if (!isBlacklisted(name) && !isProcessColor(name)) {
      colors.set(name, { type: 'NamedCS', csName: match[1], raw: match[0] });
    }
  }
  
  return colors;
}
