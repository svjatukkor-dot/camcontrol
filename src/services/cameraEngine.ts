import {
  AppRuntimeInfo,
  CameraCapabilities,
  CameraControlKey,
  CameraDevice,
  CameraSettings,
  ControlCapability,
  ResolutionPreset,
} from '../types/camera';

export const STANDARD_RESOLUTIONS: ResolutionPreset[] = [
  { label: '4K UHD (3840 × 2160)', width: 3840, height: 2160 },
  { label: 'QHD (2560 × 1440)', width: 2560, height: 1440 },
  { label: 'Full HD (1920 × 1080)', width: 1920, height: 1080 },
  { label: 'HD (1280 × 720)', width: 1280, height: 720 },
  { label: 'SVGA (800 × 600)', width: 800, height: 600 },
  { label: 'VGA (640 × 480)', width: 640, height: 480 },
];

export const STANDARD_FRAME_RATES = [60, 30, 24, 15];

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  width: 1280,
  height: 720,
  frameRate: 30,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  exposure: 0,
  whiteBalance: 5000,
  zoom: 1,
  focus: 50,
  autoFocus: true,
  autoExposure: true,
  autoWhiteBalance: true,
  mirror: false,
  showGrid: false,
  rotation: 0,
  torch: false,
  micEnabled: false,
};

interface TauriGlobal {
  core?: {
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  };
}

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  brightness?: { min?: number; max?: number; step?: number };
  contrast?: { min?: number; max?: number; step?: number };
  saturation?: { min?: number; max?: number; step?: number };
  sharpness?: { min?: number; max?: number; step?: number };
  exposureTime?: { min?: number; max?: number; step?: number };
  exposureCompensation?: { min?: number; max?: number; step?: number };
  colorTemperature?: { min?: number; max?: number; step?: number };
  zoom?: { min?: number; max?: number; step?: number };
  focusDistance?: { min?: number; max?: number; step?: number };
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
}

interface ExtendedMediaTrackSettings extends MediaTrackSettings {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
  exposureTime?: number;
  exposureCompensation?: number;
  colorTemperature?: number;
  zoom?: number;
  focusDistance?: number;
}

export function getTauriInvoke(): (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | null {
  const w = window as unknown as { __TAURI__?: TauriGlobal };
  return w.__TAURI__?.core?.invoke ?? null;
}

export function isTauriRuntime(): boolean {
  return getTauriInvoke() !== null;
}

export async function getRuntimeInfo(): Promise<AppRuntimeInfo> {
  const invoke = getTauriInvoke();
  if (invoke) {
    try {
      const info = await invoke<{
        platform: string;
        architecture: string;
        version: string;
      }>('app_info');
      return {
        mode: 'tauri',
        platform: info.platform,
        architecture: info.architecture,
        version: info.version,
        backendName:
          info.platform.toLowerCase().includes('windows')
            ? 'Windows Media Foundation (nokhwa)'
            : `Native OS Backend (${info.platform})`,
      };
    } catch {
      // Fall back to web info if invoke fails
    }
  }

  const ua = navigator.userAgent;
  let platform = 'Web Browser';
  if (ua.includes('Windows NT 10.0')) platform = 'Windows 10 / 11';
  else if (ua.includes('Windows')) platform = 'Windows';
  else if (ua.includes('Mac OS X')) platform = 'macOS';
  else if (ua.includes('Linux')) platform = 'Linux';

  return {
    mode: 'web',
    platform,
    architecture: navigator.platform || 'x64',
    version: '1.0.0',
    backendName: 'WebRTC MediaDevices / ImageCapture API',
  };
}

export function translateCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Доступ до камери заблоковано. Надайте дозвіл у браузері або налаштуваннях приватності Windows.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Підключених камер не знайдено. Перевірте USB-кабель та живлення пристрою.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Камера зайнята іншою програмою (OBS, Zoom, Teams) або драйвер не відповідає.';
      case 'OverconstrainedError':
        return 'Обрана роздільна здатність або частота кадрів не підтримується цією камерою.';
      case 'AbortError':
        return 'Запуск відеопотоку перервано системою.';
      default:
        return `Помилка відеопристрою (${error.name}): ${error.message}`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function discoverCameras(requestPermissionIfLabelsMissing = false): Promise<{
  devices: CameraDevice[];
  permissionGranted: boolean;
  warning?: string;
}> {
  const invoke = getTauriInvoke();
  let tauriDevices: CameraDevice[] = [];
  if (invoke) {
    try {
      const nativeList = await invoke<
        Array<{ id: string; name: string; description: string; backend: string }>
      >('list_cameras');
      tauriDevices = nativeList.map((d) => ({
        id: String(d.id),
        name: d.name || `Камера #${d.id}`,
        groupId: `tauri-${d.id}`,
        backend: d.backend || 'Media Foundation',
        description: d.description,
      }));
    } catch {
      // Continue with browser enumeration
    }
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    if (tauriDevices.length > 0) {
      return { devices: tauriDevices, permissionGranted: true };
    }
    throw new Error(
      'Середовище не підтримує MediaDevices API. Переконайтеся, що застосунок відкрито через HTTPS або localhost.'
    );
  }

  let mediaDevices = await navigator.mediaDevices.enumerateDevices();
  let videoInputs = mediaDevices.filter((d) => d.kind === 'videoinput');
  let permissionGranted = videoInputs.some((d) => Boolean(d.label));
  let warning: string | undefined;

  if (requestPermissionIfLabelsMissing && (videoInputs.length === 0 || !permissionGranted)) {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      tempStream.getTracks().forEach((t) => t.stop());
      permissionGranted = true;
      mediaDevices = await navigator.mediaDevices.enumerateDevices();
      videoInputs = mediaDevices.filter((d) => d.kind === 'videoinput');
    } catch (err) {
      warning = translateCameraError(err);
    }
  }

  const webDevices: CameraDevice[] = videoInputs.map((d, index) => ({
    id: d.deviceId || `cam-${index}`,
    name: d.label ? d.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '') : `USB Камера ${index + 1}`,
    groupId: d.groupId || `group-${index}`,
    backend: invoke ? 'WebView2 + Media Foundation' : 'WebRTC UVC',
    description: d.label || 'Назва буде доступна після надання дозволу',
    isDefault: index === 0,
  }));

  if (webDevices.length === 0 && tauriDevices.length > 0) {
    return { devices: tauriDevices, permissionGranted: true, warning };
  }

  return {
    devices: webDevices,
    permissionGranted,
    warning,
  };
}

export function buildDefaultCapabilities(): CameraCapabilities {
  const mkSoftwareControl = (
    key: CameraControlKey,
    label: string,
    unit: string,
    min: number,
    max: number,
    step: number,
    defaultValue: number
  ): ControlCapability => ({
    key,
    label,
    unit,
    min,
    max,
    step,
    defaultValue,
    mode: 'software',
    hardwareSupported: false,
  });

  return {
    minWidth: 320,
    maxWidth: 1920,
    minHeight: 240,
    maxHeight: 1080,
    minFrameRate: 15,
    maxFrameRate: 30,
    supportedResolutions: STANDARD_RESOLUTIONS.filter((r) => r.width <= 1920),
    supportedFrameRates: [30, 24, 15],
    controls: {
      brightness: mkSoftwareControl('brightness', 'Яскравість', '%', -100, 100, 1, 0),
      contrast: mkSoftwareControl('contrast', 'Контрастність', '%', -100, 100, 1, 0),
      saturation: mkSoftwareControl('saturation', 'Насиченість', '%', -100, 100, 1, 0),
      sharpness: mkSoftwareControl('sharpness', 'Різкість', '%', 0, 100, 1, 0),
      exposure: mkSoftwareControl('exposure', 'Експозиція', 'EV', -100, 100, 1, 0),
      whiteBalance: mkSoftwareControl('whiteBalance', 'Баланс білого', 'K', 2800, 6500, 50, 5000),
      zoom: mkSoftwareControl('zoom', 'Масштаб (Zoom)', '×', 1, 3, 0.05, 1),
      focus: mkSoftwareControl('focus', 'Фокус', '%', 0, 100, 1, 50),
    },
  };
}

export function inspectTrackCapabilities(track: MediaStreamTrack | null): CameraCapabilities {
  const base = buildDefaultCapabilities();
  if (!track || typeof track.getCapabilities !== 'function') {
    return base;
  }

  const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
  const settings = (typeof track.getSettings === 'function' ? track.getSettings() : {}) as ExtendedMediaTrackSettings;

  const minWidth = caps.width?.min ?? 320;
  const maxWidth = caps.width?.max ?? 1920;
  const minHeight = caps.height?.min ?? 240;
  const maxHeight = caps.height?.max ?? 1080;
  const minFrameRate = caps.frameRate?.min ?? 15;
  const maxFrameRate = caps.frameRate?.max ?? 30;

  const supportedResolutions = STANDARD_RESOLUTIONS.filter(
    (res) => res.width >= minWidth && res.width <= maxWidth && res.height >= minHeight && res.height <= maxHeight
  );
  if (supportedResolutions.length === 0) {
    supportedResolutions.push({
      label: `${settings.width || 1280} × ${settings.height || 720}`,
      width: settings.width || 1280,
      height: settings.height || 720,
    });
  }

  const supportedFrameRates = STANDARD_FRAME_RATES.filter(
    (fps) => fps >= Math.floor(minFrameRate) && fps <= Math.ceil(maxFrameRate)
  );
  if (supportedFrameRates.length === 0) {
    supportedFrameRates.push(Math.round(settings.frameRate || 30));
  }

  const attachHardwareRange = (
    key: CameraControlKey,
    range?: { min?: number; max?: number; step?: number }
  ) => {
    if (
      range &&
      typeof range.min === 'number' &&
      typeof range.max === 'number' &&
      range.max > range.min
    ) {
      base.controls[key] = {
        ...base.controls[key],
        mode: 'hardware',
        hardwareSupported: true,
        hardwareMin: range.min,
        hardwareMax: range.max,
        hardwareStep: range.step ?? (range.max - range.min) / 100,
      };
    }
  };

  attachHardwareRange('brightness', caps.brightness);
  attachHardwareRange('contrast', caps.contrast);
  attachHardwareRange('saturation', caps.saturation);
  attachHardwareRange('sharpness', caps.sharpness);
  attachHardwareRange('exposure', caps.exposureCompensation ?? caps.exposureTime);
  attachHardwareRange('whiteBalance', caps.colorTemperature);
  attachHardwareRange('zoom', caps.zoom);
  attachHardwareRange('focus', caps.focusDistance);

  return {
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    minFrameRate,
    maxFrameRate,
    supportedResolutions,
    supportedFrameRates,
    controls: base.controls,
  };
}

function mapUiValueToHardware(
  uiValue: number,
  cap: ControlCapability
): number {
  if (cap.hardwareMin === undefined || cap.hardwareMax === undefined) {
    return uiValue;
  }
  const ratio = (uiValue - cap.min) / (cap.max - cap.min || 1);
  const raw = cap.hardwareMin + ratio * (cap.hardwareMax - cap.hardwareMin);
  const step = cap.hardwareStep || 1;
  const snapped = Math.round(raw / step) * step;
  return Math.min(cap.hardwareMax, Math.max(cap.hardwareMin, Number(snapped.toFixed(4))));
}

export async function applyHardwareControl(
  track: MediaStreamTrack | null,
  key: CameraControlKey,
  uiValue: number,
  capabilities: CameraCapabilities,
  settings: CameraSettings
): Promise<{ appliedToHardware: boolean; detail: string }> {
  const invoke = getTauriInvoke();
  const cap = capabilities.controls[key];

  if (invoke && cap.hardwareSupported) {
    try {
      await invoke('set_camera_control', {
        control: key,
        value: mapUiValueToHardware(uiValue, cap),
      });
    } catch {
      // Continue to MediaStreamTrack attempt
    }
  }

  if (!track || !cap.hardwareSupported) {
    return {
      appliedToHardware: false,
      detail: 'Застосовано через програмний процесор перегляду',
    };
  }

  const hwValue = mapUiValueToHardware(uiValue, cap);
  const advancedConstraint: Record<string, unknown> = {};

  switch (key) {
    case 'brightness':
      advancedConstraint.brightness = hwValue;
      break;
    case 'contrast':
      advancedConstraint.contrast = hwValue;
      break;
    case 'saturation':
      advancedConstraint.saturation = hwValue;
      break;
    case 'sharpness':
      advancedConstraint.sharpness = hwValue;
      break;
    case 'exposure':
      advancedConstraint.exposureMode = settings.autoExposure ? 'continuous' : 'manual';
      advancedConstraint.exposureCompensation = hwValue;
      break;
    case 'whiteBalance':
      advancedConstraint.whiteBalanceMode = settings.autoWhiteBalance ? 'continuous' : 'manual';
      advancedConstraint.colorTemperature = hwValue;
      break;
    case 'zoom':
      advancedConstraint.zoom = hwValue;
      break;
    case 'focus':
      advancedConstraint.focusMode = settings.autoFocus ? 'continuous' : 'manual';
      if (!settings.autoFocus) {
        advancedConstraint.focusDistance = hwValue;
      }
      break;
  }

  try {
    await track.applyConstraints({
      advanced: [advancedConstraint as MediaTrackConstraintSet],
    });
    return {
      appliedToHardware: true,
      detail: `Драйвер підтвердив ${key} = ${hwValue}`,
    };
  } catch (err) {
    return {
      appliedToHardware: false,
      detail: `Драйвер відхилив апаратну зміну (${translateCameraError(err)}), переключено на програмну корекцію`,
    };
  }
}

export async function openCameraStream(
  deviceId: string,
  width: number,
  height: number,
  frameRate: number
): Promise<{
  stream: MediaStream;
  track: MediaStreamTrack;
  negotiatedWidth: number;
  negotiatedHeight: number;
  negotiatedFps: number;
  fallbackUsed: boolean;
}> {
  const tryOpen = async (constraints: MediaTrackConstraints) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: constraints,
    });
    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('Не вдалося отримати відеодоріжку з камери.');
    }
    const trackSettings = track.getSettings();
    return {
      stream,
      track,
      negotiatedWidth: trackSettings.width || width,
      negotiatedHeight: trackSettings.height || height,
      negotiatedFps: Math.round(trackSettings.frameRate || frameRate),
    };
  };

  try {
    const primary = await tryOpen({
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: frameRate },
    });
    return { ...primary, fallbackUsed: false };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'OverconstrainedError') {
      const safe = await tryOpen({
        deviceId: deviceId ? { ideal: deviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      });
      return { ...safe, fallbackUsed: true };
    }
    throw err;
  }
}
