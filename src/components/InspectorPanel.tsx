import { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import {
  CameraCapabilities,
  CameraControlKey,
  CameraDevice,
  CameraSettings,
  ResolutionPreset,
} from '../types/camera';
import {
  DEFAULT_CAMERA_SETTINGS,
  STANDARD_FRAME_RATES,
  STANDARD_RESOLUTIONS,
} from '../services/cameraEngine';

interface InspectorPanelProps {
  selectedDevice: CameraDevice | null;
  capabilities: CameraCapabilities;
  settings: CameraSettings;
  isStreaming: boolean;
  onChangeFormat: (width: number, height: number, frameRate: number) => void;
  onChangeControl: (key: CameraControlKey, value: number) => void;
  onToggleAutoMode: (modeKey: 'autoFocus' | 'autoExposure' | 'autoWhiteBalance', value: boolean) => void;
  onResetControl: (key: CameraControlKey) => void;
  onResetAll: () => void;
  onSaveProfile: (name: string) => void;
  statusFeedback: string | null;
}

const CONTROL_ORDER: CameraControlKey[] = [
  'brightness',
  'contrast',
  'saturation',
  'sharpness',
  'exposure',
  'whiteBalance',
  'zoom',
  'focus',
];

export function InspectorPanel({
  selectedDevice,
  capabilities,
  settings,
  isStreaming,
  onChangeFormat,
  onChangeControl,
  onToggleAutoMode,
  onResetControl,
  onResetAll,
  onSaveProfile,
  statusFeedback,
}: InspectorPanelProps) {
  const [profileName, setProfileName] = useState('');

  const availableResolutions: ResolutionPreset[] =
    capabilities.supportedResolutions.length > 0
      ? capabilities.supportedResolutions
      : STANDARD_RESOLUTIONS;

  const availableFps =
    capabilities.supportedFrameRates.length > 0
      ? capabilities.supportedFrameRates
      : STANDARD_FRAME_RATES;

  const currentResValue = `${settings.width}x${settings.height}`;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const finalName =
      profileName.trim() || `${selectedDevice.name.slice(0, 24)} (${settings.width}×${settings.height})`;
    onSaveProfile(finalName);
    setProfileName('');
  };

  return (
    <aside className="w-full lg:w-[344px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#233044] bg-[#131C29] flex flex-col overflow-y-auto">
      {/* Format section */}
      <div className="p-4 border-b border-[#233044] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#E8EDF5]">
            Формат та частота кадрів
          </h2>
          <span className="text-[11px] text-[#8D9BAD]">Без перезапуску</span>
        </div>

        <div>
          <label
            htmlFor="resolution-select"
            className="block text-xs text-[#9AA8BC] mb-1.5"
          >
            Роздільна здатність
          </label>
          <select
            id="resolution-select"
            value={currentResValue}
            disabled={!selectedDevice}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              if (w && h) {
                onChangeFormat(w, h, settings.frameRate);
              }
            }}
            className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#0F1723] border border-[#2C3B52] rounded-lg text-[#E8EDF5] focus:outline-none focus:border-[#3B82F6] disabled:opacity-50"
          >
            {availableResolutions.map((res) => (
              <option key={`${res.width}x${res.height}`} value={`${res.width}x${res.height}`}>
                {res.label}
              </option>
            ))}
            {!availableResolutions.some(
              (r) => r.width === settings.width && r.height === settings.height
            ) && (
              <option value={currentResValue}>
                Поточна ({settings.width} × {settings.height})
              </option>
            )}
          </select>
        </div>

        <div>
          <span className="block text-xs text-[#9AA8BC] mb-1.5">
            Частота кадрів (FPS)
          </span>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#0F1723] rounded-lg border border-[#233044]">
            {STANDARD_FRAME_RATES.map((fps) => {
              const isSupported = availableFps.includes(fps);
              const isSelected = settings.frameRate === fps;
              return (
                <button
                  key={fps}
                  type="button"
                  disabled={!selectedDevice}
                  onClick={() => onChangeFormat(settings.width, settings.height, fps)}
                  title={
                    isSupported
                      ? `Застосувати ${fps} FPS`
                      : `Спробувати ${fps} FPS (залежить від драйвера)`
                  }
                  className={`py-1.5 text-xs font-mono tabular-nums rounded-md transition-colors cursor-pointer disabled:opacity-45 ${
                    isSelected
                      ? 'bg-[#3B82F6] text-white font-semibold'
                      : isSupported
                      ? 'text-[#C7D3E3] hover:bg-[#1A2434]'
                      : 'text-[#64748B] hover:bg-[#1A2434]'
                  }`}
                >
                  {fps}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Image and optical controls */}
      <div className="p-4 border-b border-[#233044] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#E8EDF5]">
            Параметри зображення
          </h2>
          <button
            type="button"
            onClick={onResetAll}
            disabled={!selectedDevice}
            className="inline-flex items-center gap-1 text-xs text-[#9AA8BC] hover:text-[#E8EDF5] transition-colors cursor-pointer disabled:opacity-45"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Скинути все</span>
          </button>
        </div>

        <div className="space-y-4">
          {CONTROL_ORDER.map((key) => {
            const cap = capabilities.controls[key];
            const value = settings[key];
            const isDefault = Math.abs(value - DEFAULT_CAMERA_SETTINGS[key]) < 0.001;

            const autoToggleConfig =
              key === 'exposure'
                ? { field: 'autoExposure' as const, active: settings.autoExposure }
                : key === 'whiteBalance'
                ? { field: 'autoWhiteBalance' as const, active: settings.autoWhiteBalance }
                : key === 'focus'
                ? { field: 'autoFocus' as const, active: settings.autoFocus }
                : null;

            const isSliderDisabled =
              !selectedDevice ||
              (cap.mode === 'hardware' && autoToggleConfig?.active);

            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <label
                      htmlFor={`control-${key}`}
                      className="text-xs font-medium text-[#E8EDF5] truncate"
                    >
                      {cap.label}
                    </label>
                    <span
                      className={`text-[10px] font-medium shrink-0 ${
                        cap.mode === 'hardware'
                          ? 'text-[#4ADE80]'
                          : 'text-[#F59E0B]'
                      }`}
                    >
                      {cap.mode === 'hardware' ? 'Апаратно' : 'Програмно'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {autoToggleConfig && cap.mode === 'hardware' && (
                      <button
                        type="button"
                        onClick={() =>
                          onToggleAutoMode(autoToggleConfig.field, !autoToggleConfig.active)
                        }
                        className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          autoToggleConfig.active
                            ? 'border-[#3B82F6] text-[#60A5FA] bg-[#1E3A5F]/40'
                            : 'border-[#2C3B52] text-[#8D9BAD] hover:text-[#E8EDF5]'
                        }`}
                      >
                        Авто
                      </button>
                    )}

                    <span className="font-mono text-xs tabular-nums text-[#C7D3E3] min-w-[44px] text-right">
                      {key === 'zoom' ? value.toFixed(2) : Math.round(value)}
                      {cap.unit}
                    </span>

                    <button
                      type="button"
                      onClick={() => onResetControl(key)}
                      disabled={isDefault || !selectedDevice}
                      title={`Скинути: ${cap.label}`}
                      className="p-0.5 text-[#6D7E96] hover:text-[#E8EDF5] disabled:opacity-30 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <input
                  id={`control-${key}`}
                  type="range"
                  min={cap.min}
                  max={cap.max}
                  step={cap.step}
                  value={value}
                  disabled={isSliderDisabled}
                  onChange={(e) => onChangeControl(key, Number(e.target.value))}
                  className="studio-slider"
                />
              </div>
            );
          })}
        </div>

        {statusFeedback && (
          <p className="text-[11px] text-[#9AA8BC] pt-1 border-t border-[#233044]">
            {statusFeedback}
          </p>
        )}
      </div>

      {/* Save profile form */}
      <form onSubmit={handleSave} className="p-4 space-y-2.5">
        <h3 className="text-sm font-semibold text-[#E8EDF5]">
          Зберегти налаштування камери
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Назва профілю (напр. Стрим)"
            disabled={!selectedDevice}
            className="flex-1 min-w-0 px-3 py-2 text-xs bg-[#0F1723] border border-[#2C3B52] rounded-lg text-[#E8EDF5] placeholder:text-[#64748B] focus:outline-none focus:border-[#3B82F6] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!selectedDevice}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Зберегти</span>
          </button>
        </div>
        <p className="text-[11px] text-[#8D9BAD] leading-relaxed">
          {isStreaming
            ? 'Профіль автоматично підвантажується при виборі цієї камери.'
            : 'Оберіть камеру для збереження її поточного профілю.'}
        </p>
      </form>
    </aside>
  );
}
