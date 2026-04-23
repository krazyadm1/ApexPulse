import Tesseract from 'tesseract.js';

const SCAN_INTERVAL_MS = 3000;
const PACK_SCREEN_CHECK_INTERVAL_MS = 1000;

let scanning = false;
let scanTimer: ReturnType<typeof setInterval> | null = null;
let lastKnownPackCount: number | null = null;
let isOnPackScreen = false;
let ocrWorker: Tesseract.Worker | null = null;

type PackEventCallback = {
  onPacksOpened: (count: number, newTotal: number) => void;
  onPackScreenDetected: (packCount: number) => void;
  onPackScreenLeft: () => void;
};

let callbacks: PackEventCallback | null = null;

export function registerPackCallbacks(cbs: PackEventCallback): void {
  callbacks = cbs;
}

export async function initPackDetector(): Promise<void> {
  ocrWorker = await Tesseract.createWorker('eng', 1, {
    logger: () => {},
  });
  await ocrWorker.setParameters({
    tessedit_char_whitelist: '0123456789xX/',
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
  });
  console.log('[PackDetector] OCR worker initialized');
}

export function startScanning(): void {
  if (scanning) return;
  scanning = true;
  console.log('[PackDetector] Started scanning for pack openings');

  scanTimer = setInterval(async () => {
    try {
      await scanForPackScreen();
    } catch (error) {
      console.error('[PackDetector] Scan error:', error);
    }
  }, isOnPackScreen ? PACK_SCREEN_CHECK_INTERVAL_MS : SCAN_INTERVAL_MS);
}

export function stopScanning(): void {
  scanning = false;
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  isOnPackScreen = false;
  lastKnownPackCount = null;
}

async function scanForPackScreen(): Promise<void> {
  const screenshot = await captureGameScreen();
  if (!screenshot) return;

  const canvas = await loadImageToCanvas(screenshot);
  if (!canvas) return;

  // Step 1: Check if we're on the pack opening screen
  // The Apex pack screen has distinctive visual characteristics:
  // - Dark background with a centered glowing pack
  // - Pack count displayed in the UI (typically upper area or near the open button)
  // - The "APEX PACKS" text and count like "x47" or "47 APEX PACKS"
  const packScreenDetected = analyzeForPackScreen(canvas);

  if (packScreenDetected) {
    if (!isOnPackScreen) {
      isOnPackScreen = true;
      // Increase scan frequency when on pack screen
      restartScanTimer(PACK_SCREEN_CHECK_INTERVAL_MS);
    }

    // Step 2: OCR the pack count region
    const packCount = await ocrPackCount(canvas);

    if (packCount !== null) {
      if (lastKnownPackCount !== null && packCount < lastKnownPackCount) {
        // Pack count decreased — packs were opened
        const opened = lastKnownPackCount - packCount;
        const currentTotal = getStoredPackCount() + opened;
        setStoredPackCount(currentTotal);

        if (callbacks) {
          callbacks.onPacksOpened(opened, currentTotal);
        }
        console.log(`[PackDetector] ${opened} pack(s) opened! Total: ${currentTotal}`);
      } else if (lastKnownPackCount === null) {
        // First detection on this screen visit
        if (callbacks) {
          callbacks.onPackScreenDetected(packCount);
        }
      }

      lastKnownPackCount = packCount;
    }
  } else if (isOnPackScreen) {
    // Left the pack screen
    isOnPackScreen = false;
    lastKnownPackCount = null;
    restartScanTimer(SCAN_INTERVAL_MS);
    if (callbacks) {
      callbacks.onPackScreenLeft();
    }
  }
}

function restartScanTimer(intervalMs: number): void {
  if (scanTimer) clearInterval(scanTimer);
  if (!scanning) return;
  scanTimer = setInterval(async () => {
    try {
      await scanForPackScreen();
    } catch (error) {
      console.error('[PackDetector] Scan error:', error);
    }
  }, intervalMs);
}

// === Screen Capture ===

async function captureGameScreen(): Promise<string | null> {
  try {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL();
    }
  } catch {
    // desktopCapturer not available
  }
  return null;
}

function loadImageToCanvas(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// === Pack Screen Detection ===
// The Apex pack opening screen has:
// 1. Very dark background (most of the screen is near-black)
// 2. A bright glow in the center (the pack itself)
// 3. UI elements with the pack count
//
// We check several regions for expected color profiles:
// - Top-center: should be dark (menu background)
// - Center: should have bright pixels (pack glow)
// - Bottom area near "Open" button: specific UI colors

function analyzeForPackScreen(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const w = canvas.width;
  const h = canvas.height;

  // Sample the background darkness (top-left quadrant)
  const bgSample = ctx.getImageData(Math.floor(w * 0.05), Math.floor(h * 0.05), 100, 100);
  const bgBrightness = averageBrightness(bgSample.data);

  // Pack screen background is very dark (< 30 brightness on average)
  if (bgBrightness > 40) return false;

  // Check for bright center region (pack glow)
  const centerSample = ctx.getImageData(
    Math.floor(w * 0.4), Math.floor(h * 0.3),
    Math.floor(w * 0.2), Math.floor(h * 0.2)
  );
  const centerBrightness = averageBrightness(centerSample.data);

  // Center should be brighter than background (pack glow effect)
  if (centerBrightness < bgBrightness + 20) return false;

  // Check for UI elements in the pack count region (top-right area)
  // Pack count is typically shown as white/light text
  const uiSample = ctx.getImageData(
    Math.floor(w * 0.7), Math.floor(h * 0.02),
    Math.floor(w * 0.25), Math.floor(h * 0.08)
  );
  const uiHasLightText = hasLightPixels(uiSample.data, 0.03);

  // Also check bottom-center for the "Open" button area
  const btnSample = ctx.getImageData(
    Math.floor(w * 0.35), Math.floor(h * 0.8),
    Math.floor(w * 0.3), Math.floor(h * 0.1)
  );
  const btnHasLightPixels = hasLightPixels(btnSample.data, 0.02);

  return uiHasLightText && btnHasLightPixels;
}

function averageBrightness(data: Uint8ClampedArray): number {
  let total = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    total += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  return total / pixelCount;
}

function hasLightPixels(data: Uint8ClampedArray, threshold: number): boolean {
  let lightCount = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness > 180) lightCount++;
  }
  return (lightCount / pixelCount) > threshold;
}

// === OCR Pack Count ===
// Scan multiple possible regions where the pack count could appear:
// 1. Top-right: "x47" or "47 APEX PACKS"
// 2. Center-top: pack count above the pack
// 3. Bottom: near the "Open" button "Open 47 Packs"

async function ocrPackCount(canvas: HTMLCanvasElement): Promise<number | null> {
  if (!ocrWorker) return null;

  const regions = [
    // Top-right corner (common pack count location)
    { x: 0.65, y: 0.01, w: 0.30, h: 0.08 },
    // Upper-center (above pack)
    { x: 0.30, y: 0.05, w: 0.40, h: 0.10 },
    // Bottom-center (near "Open X Packs" button)
    { x: 0.30, y: 0.78, w: 0.40, h: 0.12 },
    // Right side pack count indicator
    { x: 0.75, y: 0.10, w: 0.20, h: 0.10 },
  ];

  for (const region of regions) {
    const count = await ocrRegion(canvas, region);
    if (count !== null && count > 0 && count <= 9999) {
      return count;
    }
  }

  return null;
}

async function ocrRegion(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number }
): Promise<number | null> {
  if (!ocrWorker) return null;

  const w = canvas.width;
  const h = canvas.height;

  // Crop the region
  const cropCanvas = document.createElement('canvas');
  const cropW = Math.floor(w * region.w);
  const cropH = Math.floor(h * region.h);
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const ctx = cropCanvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(
    canvas,
    Math.floor(w * region.x), Math.floor(h * region.y),
    cropW, cropH,
    0, 0, cropW, cropH
  );

  // Preprocess: increase contrast, convert to grayscale, threshold
  const imageData = ctx.getImageData(0, 0, cropW, cropH);
  preprocessForOCR(imageData);
  ctx.putImageData(imageData, 0, 0);

  try {
    const result = await ocrWorker.recognize(cropCanvas);
    const text = result.data.text.trim();

    // Extract number from OCR text
    // Patterns: "x47", "47", "x 47", "47 APEX PACKS", "Open 47 Packs"
    const match = text.match(/[xX]?\s*(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch {
    // OCR failed for this region
  }

  return null;
}

function preprocessForOCR(imageData: ImageData): void {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Threshold: light text on dark background → invert and binarize
    const value = gray > 140 ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

// === Pack Count Storage ===

function getStoredPackCount(): number {
  try {
    const { app } = require('electron');
    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(app.getPath('userData'), 'pack-count.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.count || 0;
  } catch {
    return 0;
  }
}

function setStoredPackCount(count: number): void {
  try {
    const { app } = require('electron');
    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(app.getPath('userData'), 'pack-count.json');
    fs.writeFileSync(filePath, JSON.stringify({ count }));
  } catch { /* ignore */ }
}

export function getPackCount(): number {
  return getStoredPackCount();
}

export function setPackCount(count: number): void {
  setStoredPackCount(count);
}

// === Cleanup ===

export async function cleanupPackDetector(): Promise<void> {
  stopScanning();
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }
}
