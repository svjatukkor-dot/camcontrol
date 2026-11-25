export type AppTab = 'studio' | 'diagnostics' | 'profiles' | 'windows-build';

export type RuntimeMode = 'web' | 'tauri';

export type CameraControlKey =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'sharpness'
  | 'exposure'
  | 'whiteBalance'
  | 'zoom'
  | 'focus';

export type ControlMode = 'hardware' | 'software';

export interface ResolutionPreset {
  label: string;
  width: number;
  height: number;
}

export interface CameraDevice {
  id: string;
  name: string;
  groupId: string;
  backend: string;
  description?: string;
  isDefault?: boolean;
}

export interface ControlCapability {
  key: CameraControlKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  mode: ControlMode;
  hardwareSupported: boolean;
  hardwareMin?: number;
  hardwareMax?: number;
  hardwareStep?: number;
}

export interface CameraCapabilities {
  maxWidth: number;
  maxHeight: number;
  minWidth: number;
  minHeight: number;
  maxFrameRate: number;
  minFrameRate: number;
  supportedResolutions: ResolutionPreset[];
  supportedFrameRates: number[];
  controls: Record<CameraControlKey, ControlCapability>;
}

export interface CameraSettings {
  width: number;
  height: number;
  frameRate: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  exposure: number;
  whiteBalance: number;
  zoom: number;
  focus: number;
  autoFocus: boolean;
  autoExposure: boolean;
  autoWhiteBalance: boolean;
  mirror: boolean;
  showGrid: boolean;
  rotation: 0 | 90 | 180 | 270;
  torch: boolean;
  micEnabled: boolean;
}

export type PhoneRemoteCommand =
  | { action: 'flip-camera' }
  | { action: 'set-torch'; enabled: boolean }
  | { action: 'set-resolution'; width: number; height: number }
  | { action: 'set-mic'; enabled: boolean };

export interface CameraProfile {
  id: string;
  name: string;
  cameraKey: string;
  cameraName: string;
  updatedAt: string;
  settings: CameraSettings;
}

export interface StreamMetrics {
  active: boolean;
  actualWidth: number;
  actualHeight: number;
  requestedWidth: number;
  requestedHeight: number;
  measuredFps: number;
  targetFps: number;
  frameTimeMs: number;
  totalFrames: number;
  droppedFrames: number;
  aspectRatio: string;
  hardwareControlsCount: number;
  softwareControlsCount: number;
}

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  source: string;
  message: string;
}

export interface SnapshotItem {
  id: string;
  cameraName: string;
  timestamp: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface AppRuntimeInfo {
  mode: RuntimeMode;
  platform: string;
  architecture: string;
  version: string;
  backendName: string;
}
