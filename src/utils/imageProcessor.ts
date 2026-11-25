import { CameraCapabilities, CameraSettings } from '../types/camera';

/**
 * Renders the active video frame onto the target canvas applying rotation, mirror,
 * zoom, and software-fallback corrections for any controls not handled natively.
 */
export function renderProcessedFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  settings: CameraSettings,
  capabilities: CameraCapabilities,
  options: {
    compareSplit?: boolean;
    splitRatio?: number;
    includeOverlayGrid?: boolean;
  } = {}
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const isQuarterTurn = settings.rotation === 90 || settings.rotation === 270;
  const targetW = isQuarterTurn ? vh : vw;
  const targetH = isQuarterTurn ? vw : vh;

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const isHardware = (key: keyof CameraCapabilities['controls']) =>
    capabilities.controls[key]?.mode === 'hardware';

  const swBrightness = isHardware('brightness') ? 0 : settings.brightness;
  const swContrast = isHardware('contrast') ? 0 : settings.contrast;
  const swSaturation = isHardware('saturation') ? 0 : settings.saturation;
  const swExposure = isHardware('exposure') ? 0 : settings.exposure;
  const swWhiteBalance = isHardware('whiteBalance') ? 5000 : settings.whiteBalance;
  const swSharpness = isHardware('sharpness') ? 0 : settings.sharpness;
  const swZoom = isHardware('zoom') ? 1 : settings.zoom;

  const brightnessFactor = Math.max(
    0.1,
    1 + swBrightness / 100 + swExposure / 140
  );
  const contrastFactor = Math.max(0.1, 1 + swContrast / 100);
  const saturateFactor = Math.max(0, 1 + swSaturation / 100);

  const wbDelta = (swWhiteBalance - 5000) / 1000;
  const sepiaPct = wbDelta > 0 ? Math.min(35, wbDelta * 18) : 0;
  const hueShift = wbDelta < 0 ? Math.max(-18, wbDelta * 8) : 0;

  const filterString = [
    `brightness(${brightnessFactor.toFixed(3)})`,
    `contrast(${contrastFactor.toFixed(3)})`,
    `saturate(${saturateFactor.toFixed(3)})`,
    sepiaPct > 0 ? `sepia(${sepiaPct.toFixed(1)}%)` : '',
    hueShift !== 0 ? `hue-rotate(${hueShift.toFixed(1)}deg)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const zoom = Math.max(1, swZoom);
  const cropW = vw / zoom;
  const cropH = vh / zoom;
  const cropX = (vw - cropW) / 2;
  const cropY = (vh - cropH) / 2;

  const drawVideoTransformed = (useFilters: boolean) => {
    ctx.save();
    ctx.filter = useFilters ? filterString || 'none' : 'none';
    ctx.translate(targetW / 2, targetH / 2);
    if (settings.rotation !== 0) {
      ctx.rotate((settings.rotation * Math.PI) / 180);
    }
    if (settings.mirror) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, cropX, cropY, cropW, cropH, -vw / 2, -vh / 2, vw, vh);
    ctx.restore();
  };

  if (options.compareSplit) {
    const splitX = Math.round(targetW * (options.splitRatio ?? 0.5));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, targetH);
    ctx.clip();
    drawVideoTransformed(false);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, targetW - splitX, targetH);
    ctx.clip();
    drawVideoTransformed(true);
    ctx.restore();
  } else {
    drawVideoTransformed(true);
  }

  if (wbDelta < -0.1) {
    ctx.save();
    if (options.compareSplit) {
      const splitX = Math.round(targetW * (options.splitRatio ?? 0.5));
      ctx.beginPath();
      ctx.rect(splitX, 0, targetW - splitX, targetH);
      ctx.clip();
    }
    ctx.fillStyle = `rgba(56, 139, 253, ${Math.min(0.18, Math.abs(wbDelta) * 0.08)})`;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.restore();
  }

  if (swSharpness > 2) {
    applyUnsharpKernel(
      ctx,
      targetW,
      targetH,
      swSharpness / 100,
      options.compareSplit ? Math.round(targetW * (options.splitRatio ?? 0.5)) : 0
    );
  }

  if (options.compareSplit) {
    const splitX = Math.round(targetW * (options.splitRatio ?? 0.5));
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 237, 245, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, targetH);
    ctx.stroke();

    ctx.fillStyle = 'rgba(12, 17, 26, 0.82)';
    ctx.fillRect(Math.max(8, splitX - 58), 12, 50, 22);
    ctx.fillRect(Math.min(targetW - 58, splitX + 8), 12, 50, 22);
    ctx.fillStyle = '#E8EDF5';
    ctx.font = '600 11px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ДО', Math.max(33, splitX - 33), 23);
    ctx.fillText('ПІСЛЯ', Math.min(targetW - 33, splitX + 33), 23);
    ctx.restore();
  }

  if (options.includeOverlayGrid && settings.showGrid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 237, 245, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const x = Math.round((targetW * i) / 3);
      const y = Math.round((targetH * i) / 3);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, targetH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(targetW, y);
      ctx.stroke();
    }
    const cx = targetW / 2;
    const cy = targetH / 2;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.55)';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();
    ctx.restore();
  }
}

function applyUnsharpKernel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
  startX: number
): void {
  const regionWidth = width - startX;
  if (regionWidth <= 2 || height <= 2) return;
  if (width * height > 2560 * 1440) return;

  const imgData = ctx.getImageData(startX, 0, regionWidth, height);
  const src = imgData.data;
  const out = new Uint8ClampedArray(src.length);
  const strength = amount * 0.85;
  const centerWeight = 1 + 4 * strength;
  const sideWeight = -strength;
  const rowStride = regionWidth * 4;

  out.set(src);

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * rowStride;
    for (let x = 1; x < regionWidth - 1; x++) {
      const i = rowOffset + x * 4;
      const top = i - rowStride;
      const bottom = i + rowStride;
      const left = i - 4;
      const right = i + 4;

      out[i] =
        src[i] * centerWeight +
        (src[top] + src[bottom] + src[left] + src[right]) * sideWeight;
      out[i + 1] =
        src[i + 1] * centerWeight +
        (src[top + 1] + src[bottom + 1] + src[left + 1] + src[right + 1]) * sideWeight;
      out[i + 2] =
        src[i + 2] * centerWeight +
        (src[top + 2] + src[bottom + 2] + src[left + 2] + src[right + 2]) * sideWeight;
      out[i + 3] = src[i + 3];
    }
  }

  imgData.data.set(out);
  ctx.putImageData(imgData, startX, 0);
}

export function captureCleanSnapshot(
  video: HTMLVideoElement,
  settings: CameraSettings,
  capabilities: CameraCapabilities
): { dataUrl: string; width: number; height: number } | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const offscreen = document.createElement('canvas');
  renderProcessedFrame(video, offscreen, settings, capabilities, {
    compareSplit: false,
    includeOverlayGrid: false,
  });
  return {
    dataUrl: offscreen.toDataURL('image/png'),
    width: offscreen.width,
    height: offscreen.height,
  };
}
