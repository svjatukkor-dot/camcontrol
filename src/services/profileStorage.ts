import { CameraDevice, CameraProfile, CameraSettings } from '../types/camera';
import { DEFAULT_CAMERA_SETTINGS } from './cameraEngine';

const PROFILES_STORAGE_KEY = 'camcontrol.profiles.v1';
const LAST_CAMERA_KEY = 'camcontrol.lastCameraId.v1';

export function buildCameraKey(device: CameraDevice): string {
  const normalizedName = device.name.trim().toLowerCase().replace(/\s+/g, '-');
  return `${normalizedName}::${device.groupId || device.id}`;
}

export function loadProfiles(): CameraProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidProfile);
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: CameraProfile[]): void {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

export function getLastSelectedCameraId(): string | null {
  try {
    return localStorage.getItem(LAST_CAMERA_KEY);
  } catch {
    return null;
  }
}

export function setLastSelectedCameraId(id: string): void {
  try {
    localStorage.setItem(LAST_CAMERA_KEY, id);
  } catch {
    // ignore storage limits
  }
}

function isValidSettings(obj: unknown): obj is CameraSettings {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.width === 'number' &&
    typeof s.height === 'number' &&
    typeof s.frameRate === 'number' &&
    typeof s.brightness === 'number' &&
    typeof s.contrast === 'number' &&
    typeof s.saturation === 'number' &&
    typeof s.sharpness === 'number'
  );
}

export function isValidProfile(obj: unknown): obj is CameraProfile {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.cameraKey === 'string' &&
    typeof p.cameraName === 'string' &&
    typeof p.updatedAt === 'string' &&
    isValidSettings(p.settings)
  );
}

export function createProfileRecord(
  name: string,
  device: CameraDevice,
  settings: CameraSettings
): CameraProfile {
  return {
    id: `prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Профіль (${device.name})`,
    cameraKey: buildCameraKey(device),
    cameraName: device.name,
    updatedAt: new Date().toISOString(),
    settings: { ...settings },
  };
}

export function findMatchingProfileForDevice(
  profiles: CameraProfile[],
  device: CameraDevice
): CameraProfile | undefined {
  const key = buildCameraKey(device);
  const exact = profiles.find((p) => p.cameraKey === key);
  if (exact) return exact;
  return profiles.find(
    (p) => p.cameraName.toLowerCase() === device.name.toLowerCase()
  );
}

export function exportProfilesToJson(profiles: CameraProfile[]): string {
  return JSON.stringify(
    {
      application: 'CamControl',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profiles,
    },
    null,
    2
  );
}

export function parseImportedProfilesJson(jsonText: string): {
  profiles: CameraProfile[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed) ? parsed : parsed?.profiles;
    if (!Array.isArray(list)) {
      return {
        profiles: [],
        error: 'Невірна структура JSON: очікується масив профілів або поле "profiles".',
      };
    }

    const valid: CameraProfile[] = [];
    for (const item of list) {
      if (isValidProfile(item)) {
        valid.push({
          ...item,
          settings: { ...DEFAULT_CAMERA_SETTINGS, ...item.settings },
        });
      }
    }

    if (valid.length === 0) {
      return {
        profiles: [],
        error: 'У файлі не знайдено жодного коректного профілю налаштувань камери.',
      };
    }

    return { profiles: valid };
  } catch (err) {
    return {
      profiles: [],
      error: `Помилка розбору JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
