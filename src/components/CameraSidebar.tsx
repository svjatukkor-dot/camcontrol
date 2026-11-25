import {
  Bookmark,
  Camera,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Usb,
  Wifi,
} from 'lucide-react';
import { CameraDevice, CameraProfile } from '../types/camera';
import { buildCameraKey } from '../services/profileStorage';

interface CameraSidebarProps {
  devices: CameraDevice[];
  selectedDeviceId: string | null;
  onSelectDevice: (device: CameraDevice) => void;
  isScanning: boolean;
  permissionGranted: boolean;
  onRequestPermission: () => void;
  discoveryWarning: string | null;
  profiles: CameraProfile[];
  activeProfileId: string | null;
  onApplyProfile: (profile: CameraProfile) => void;
  onOpenPhoneModal: (tab: 'wifi' | 'usb') => void;
  pairingCode: string | null;
  bridgeStatus: 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';
  onOpenPhoneModeHere: () => void;
}

export function CameraSidebar({
  devices,
  selectedDeviceId,
  onSelectDevice,
  isScanning,
  permissionGranted,
  onRequestPermission,
  discoveryWarning,
  profiles,
  activeProfileId,
  onApplyProfile,
  onOpenPhoneModal,
  pairingCode,
  bridgeStatus,
  onOpenPhoneModeHere,
}: CameraSidebarProps) {
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || null;
  const selectedKey = selectedDevice ? buildCameraKey(selectedDevice) : null;
  const isInsideIframe = typeof window !== 'undefined' && window.top !== window.self;

  const relevantProfiles = selectedDevice
    ? profiles.filter(
        (p) =>
          p.cameraKey === selectedKey ||
          p.cameraName.toLowerCase() === selectedDevice.name.toLowerCase()
      )
    : profiles;

  return (
    <aside className="w-full lg:w-[276px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#233044] bg-[#131C29] flex flex-col">
      {/* DropCam Phone Quick Connect block */}
      <div className="p-4 border-b border-[#233044] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-[#60A5FA]" />
            <h2 className="text-sm font-semibold text-[#E8EDF5]">Телефон (DropCam)</h2>
          </div>
          <span
            className={`text-[11px] font-medium ${
              bridgeStatus === 'connected'
                ? 'text-[#4ADE80]'
                : bridgeStatus === 'connecting'
                ? 'text-[#60A5FA]'
                : 'text-[#8D9BAD]'
            }`}
          >
            {bridgeStatus === 'connected'
              ? 'Онлайн'
              : bridgeStatus === 'connecting'
              ? 'З’єднання…'
              : 'Готовий'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[#0F1723] border border-[#233044] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8D9BAD]">Код Wi-Fi:</span>
            <span className="font-mono font-bold tracking-widest tabular-nums text-[#E8EDF5]">
              {pairingCode || '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onOpenPhoneModal('wifi')}
              className="py-1.5 px-2 rounded-md bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Wifi className="w-3 h-3" />
              <span>QR / Wi-Fi</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPhoneModal('usb')}
              className="py-1.5 px-2 rounded-md bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] text-[#E8EDF5] text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Usb className="w-3 h-3" />
              <span>USB-кабель</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPhoneModeHere}
          className="w-full py-1.5 px-3 rounded-md border border-[#233044] bg-[#0C111A] hover:bg-[#172130] text-[11px] font-medium text-[#93C5FD] cursor-pointer text-center"
        >
          Відкрито на телефоні? Увімкнути передачу →
        </button>
      </div>

      {/* Connected devices list */}
      <div className="p-4 border-b border-[#233044]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[#E8EDF5]">Джерела відео</h2>
          <span className="font-mono text-xs tabular-nums text-[#8D9BAD]">
            {devices.length}
          </span>
        </div>

        {!permissionGranted && (
          <div className="mb-3 p-3 rounded-lg bg-[#1A2434] border border-[#2C3B52] text-xs text-[#C7D3E3] space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Дозвольте доступ до камер для виявлення USB-камер та телефона у режимі вебкамери.
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestPermission}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Надати доступ</span>
            </button>
            {isInsideIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 text-[11px] font-medium text-[#93C5FD] hover:text-white bg-[#0F1723] border border-[#233044] rounded-md inline-flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Відкрити в окремій вкладці</span>
              </a>
            )}
          </div>
        )}

        {discoveryWarning && (
          <p className="mb-3 text-xs text-[#F87171] leading-relaxed">
            {discoveryWarning}
          </p>
        )}

        {isScanning && devices.length === 0 ? (
          <div className="space-y-2" aria-label="Сканування камер">
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="h-16 rounded-lg bg-[#1A2434] animate-pulse border border-[#233044]"
              />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="py-5 px-3 text-center border border-dashed border-[#2C3B52] rounded-lg space-y-1.5">
            <Camera className="w-5 h-5 text-[#6D7E96] mx-auto" />
            <p className="text-xs text-[#9AA8BC] leading-relaxed">
              USB-камер не знайдено. Скористайтеся QR-кодом праворуч для підключення телефона.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device, index) => {
              const isSelected = device.id === selectedDeviceId;
              return (
                <button
                  key={device.id || index}
                  type="button"
                  onClick={() => onSelectDevice(device)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3B82F6] ${
                    isSelected
                      ? 'bg-[#1A2434] border-[#3B82F6] text-[#E8EDF5]'
                      : 'bg-[#0F1723] border-[#233044] text-[#C7D3E3] hover:border-[#374B69] hover:bg-[#172130]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">
                      {device.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8D9BAD] truncate">
                    <span>{device.backend}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">#{index + 1}</span>
                    {isSelected && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#60A5FA] font-medium">Активна</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Saved Profiles */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-[#E8EDF5]">
            {selectedDevice ? 'Профілі камери' : 'Збережені профілі'}
          </h3>
          <span className="font-mono text-xs tabular-nums text-[#8D9BAD]">
            {relevantProfiles.length}
          </span>
        </div>

        {relevantProfiles.length === 0 ? (
          <p className="text-xs text-[#8D9BAD] leading-relaxed">
            Збережених профілів ще немає. Налаштуйте картинку праворуч та натисніть «Зберегти».
          </p>
        ) : (
          <div className="space-y-1.5">
            {relevantProfiles.map((profile) => {
              const isCurrent = profile.id === activeProfileId;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onApplyProfile(profile)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isCurrent
                      ? 'bg-[#1A2434] border-[#3B82F6]/70 text-[#E8EDF5]'
                      : 'bg-[#0F1723] border-[#233044] text-[#C7D3E3] hover:border-[#374B69]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                      <span className="text-xs font-semibold truncate">
                        {profile.name}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono tabular-nums text-[#8D9BAD]">
                      {profile.settings.width}×{profile.settings.height} ·{' '}
                      {profile.settings.frameRate} FPS
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-[11px] text-[#60A5FA] font-medium shrink-0">
                      Активний
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
