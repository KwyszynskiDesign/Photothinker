/**
 * Image processing utilities for RIP Preview
 */

/**
 * Generate a composite CMYK preview from selected channels
 */
export function compositeChannelsToRgb(
  channels: {
    name: string;
    data: Uint8ClampedArray;
    enabled: boolean;
    cmykRecipe: [number, number, number, number];
    kind: string;
  }[],
  width: number,
  height: number
): ImageData {
  const pixelCount = width * height;
  const result = new ImageData(width, height);

  // Accumulate CMYK values
  const c = new Float32Array(pixelCount);
  const m = new Float32Array(pixelCount);
  const y = new Float32Array(pixelCount);
  const k = new Float32Array(pixelCount);

  for (const channel of channels) {
    if (!channel.enabled) continue;

    const recipe = channel.cmykRecipe;
    const isProcess = channel.kind === 'process';

    for (let i = 0; i < pixelCount; i++) {
      const val = channel.data[i] / 255;
      if (isProcess) {
        switch (channel.name) {
          case 'Cyan': c[i] += val; break;
          case 'Magenta': m[i] += val; break;
          case 'Yellow': y[i] += val; break;
          case 'Black': k[i] += val; break;
        }
      } else {
        // Spot colors use their CMYK recipe
        c[i] += val * (recipe[0] / 100);
        m[i] += val * (recipe[1] / 100);
        y[i] += val * (recipe[2] / 100);
        k[i] += val * (recipe[3] / 100);
      }
    }
  }

  // Convert accumulated CMYK to RGB
  for (let i = 0; i < pixelCount; i++) {
    const cc = Math.min(c[i], 1);
    const mm = Math.min(m[i], 1);
    const yy = Math.min(y[i], 1);
    const kk = Math.min(k[i], 1);

    const r = Math.round(255 * (1 - cc) * (1 - kk));
    const g = Math.round(255 * (1 - mm) * (1 - kk));
    const b = Math.round(255 * (1 - yy) * (1 - kk));

    result.data[i * 4] = Math.max(0, Math.min(255, r));
    result.data[i * 4 + 1] = Math.max(0, Math.min(255, g));
    result.data[i * 4 + 2] = Math.max(0, Math.min(255, b));
    result.data[i * 4 + 3] = 255;
  }

  return result;
}

/**
 * Render a single plate as a grayscale or colored image
 */
export function renderPlate(
  channelData: Uint8ClampedArray,
  width: number,
  height: number,
  displayColor?: string
): ImageData {
  const pixelCount = width * height;
  const result = new ImageData(width, height);

  let cr = 0, cg = 0, cb = 0;
  if (displayColor) {
    const match = displayColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      cr = parseInt(match[1]);
      cg = parseInt(match[2]);
      cb = parseInt(match[3]);
    } else if (displayColor.startsWith('#')) {
      const hex = displayColor.slice(1);
      cr = parseInt(hex.slice(0, 2), 16);
      cg = parseInt(hex.slice(2, 4), 16);
      cb = parseInt(hex.slice(4, 6), 16);
    }
  }

  const useColor = !!displayColor;

  for (let i = 0; i < pixelCount; i++) {
    const val = channelData[i] / 255; // ink density 0-1

    if (useColor) {
      const bg = 245;
      result.data[i * 4] = Math.round(bg * (1 - val) + cr * val);
      result.data[i * 4 + 1] = Math.round(bg * (1 - val) + cg * val);
      result.data[i * 4 + 2] = Math.round(bg * (1 - val) + cb * val);
    } else {
      // Grayscale: 255 = paper, 0 = full ink
      const gray = Math.round(255 * (1 - val));
      result.data[i * 4] = gray;
      result.data[i * 4 + 1] = gray;
      result.data[i * 4 + 2] = gray;
    }
    result.data[i * 4 + 3] = 255;
  }

  return result;
}

/**
 * Apply halftone simulation to a channel
 */
export function applyHalftone(
  channel: Uint8ClampedArray,
  width: number,
  height: number,
  cellSize: number,
  angle: number,
  minDotPercent: number,
  forceSolid: boolean = false
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height);
  const cutoff = Math.round((minDotPercent / 100) * 255);

  if (forceSolid) {
    for (let i = 0; i < result.length; i++) {
      result[i] = channel[i] > 127 ? 255 : 0;
    }
    return result;
  }

  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = py * width + px;
      const val = channel[idx];

      if (val <= cutoff) {
        result[idx] = 0;
        continue;
      }

      const rx = px * cosA + py * sinA;
      const ry = -px * sinA + py * cosA;

      const cx = ((rx % cellSize) + cellSize) % cellSize;
      const cy = ((ry % cellSize) + cellSize) % cellSize;

      const dist = Math.sqrt(
        Math.pow(cx - cellSize / 2, 2) + Math.pow(cy - cellSize / 2, 2)
      );
      const maxDist = (cellSize / 2) * Math.SQRT2;
      const threshold = Math.round((dist / maxDist) * 255);

      result[idx] = val >= threshold ? 255 : 0;
    }
  }

  return result;
}

/**
 * Calculate ink coverage percentage
 */
export function calculateCoverage(data: Uint8ClampedArray): number {
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    total += data[i];
  }
  return (total / (data.length * 255)) * 100;
}

/**
 * Estimate spot channel from rendered CMYK using recipe matching.
 * 
 * This is a heuristic approach since we lose actual spot channel data
 * when PDF.js renders to RGB. We try to find pixels that match the
 * spot color's CMYK recipe.
 */
export function estimateSpotChannel(
  cyan: Uint8ClampedArray,
  magenta: Uint8ClampedArray,
  yellow: Uint8ClampedArray,
  black: Uint8ClampedArray,
  recipe: [number, number, number, number],
  width: number,
  height: number
): Uint8ClampedArray {
  const pixelCount = width * height;
  const result = new Uint8ClampedArray(pixelCount);

  // Recipe ratios (0-1)
  const rc = recipe[0] / 100;
  const rm = recipe[1] / 100;
  const ry = recipe[2] / 100;
  const rk = recipe[3] / 100;

  // Tolerance for matching
  const tolerance = 30;

  for (let i = 0; i < pixelCount; i++) {
    const c = cyan[i];
    const m = magenta[i];
    const y = yellow[i];
    const k = black[i];

    // Skip if all channels are very low (white/near-white)
    if (c < 5 && m < 5 && y < 5 && k < 5) {
      result[i] = 0;
      continue;
    }

    // Calculate what intensity of spot color would produce these CMYK values
    let intensity = 0;
    let count = 0;

    if (rc > 0.05) {
      intensity += c / (rc * 255);
      count++;
    }
    if (rm > 0.05) {
      intensity += m / (rm * 255);
      count++;
    }
    if (ry > 0.05) {
      intensity += y / (ry * 255);
      count++;
    }
    if (rk > 0.05) {
      intensity += k / (rk * 255);
      count++;
    }

    if (count === 0) {
      result[i] = 0;
      continue;
    }

    intensity = intensity / count;

    // Check if this pixel matches the recipe ratio
    let isMatch = true;
    if (rc > 0.05 && Math.abs(c - intensity * rc * 255) > tolerance) isMatch = false;
    if (rm > 0.05 && Math.abs(m - intensity * rm * 255) > tolerance) isMatch = false;
    if (ry > 0.05 && Math.abs(y - intensity * ry * 255) > tolerance) isMatch = false;
    if (rk > 0.05 && Math.abs(k - intensity * rk * 255) > tolerance) isMatch = false;

    // Also check that channels with 0 recipe are actually low
    if (rc < 0.05 && c > tolerance) isMatch = false;
    if (rm < 0.05 && m > tolerance) isMatch = false;
    if (ry < 0.05 && y > tolerance) isMatch = false;
    if (rk < 0.05 && k > tolerance) isMatch = false;

    if (isMatch) {
      result[i] = Math.min(255, Math.round(intensity * 255));
    } else {
      result[i] = 0;
    }
  }

  return result;
}

/**
 * Create process color channels directly from RGB image data.
 * Uses proper UCR/GCR conversion.
 */
export function extractProcessChannels(
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

    // Calculate K first (UCR approach)
    const k = 1 - Math.max(r, g, b);
    
    if (k >= 0.9999) {
      // Pure black pixel
      cyan[i] = 0;
      magenta[i] = 0;
      yellow[i] = 0;
      black[i] = 255;
    } else {
      // Normal CMY with K
      const invK = 1 / (1 - k);
      cyan[i] = Math.round(Math.max(0, Math.min(1, (1 - r - k) * invK)) * 255);
      magenta[i] = Math.round(Math.max(0, Math.min(1, (1 - g - k) * invK)) * 255);
      yellow[i] = Math.round(Math.max(0, Math.min(1, (1 - b - k) * invK)) * 255);
      black[i] = Math.round(k * 255);
    }
  }

  return { cyan, magenta, yellow, black };
}
