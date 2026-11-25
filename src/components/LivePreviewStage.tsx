import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Camera,
  Check,
  Columns2,
  Copy,
  Download,
  Flashlight,
  FlipHorizontal2,
  Grid3X3,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  RotateCw,
  Smartphone,
  Square,
  SwitchCamera,
  Trash2,
} from 'lucide-react';
import {
  CameraDevice,
  CameraSettings,
  SnapshotItem,
  StreamMetrics,
} from '../types/camera';

interface LivePreviewStageProps {
  selectedDevice: CameraDevice | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isStreaming: boolean;
  isStarting: boolean;
  streamError: string | null;
  metrics: StreamMetrics;
  settings: CameraSettings;
  compareSplit: boolean;
  splitRatio: number;
  onToggleStream: () => void;
  onTakeSnapshot: () => void;
  onToggleMirror: () => void;
  onToggleGrid: () => void;
  onRotate90: () => void;
  onToggleCompare: () => void;
  onSplitRatioChange: (ratio: number) => void;
  onRemoteFlipPhone: () => void;
  onRemoteToggleTorch: () => void;
  onRemoteToggleMic: () => void;
  snapshots: SnapshotItem[];
  onDownloadSnapshot: (snap: SnapshotItem) => void;
  onRemoveSnapshot: (id: string) => void;
  pairingCode: string | null;
  bridgeStatus: 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';
  bridgeStatusText: string;
  onRefreshPairingCode: () => void;
  onOpenPhoneModeHere: () => void;
  onOpenUsbHelp: () => void;
  onClearStreamError: () => void;
}

export function LivePreviewStage({
  selectedDevice,
  videoRef,
  canvasRef,
  isStreaming,
  isStarting,
  streamError,
  metrics,
  settings,
  compareSplit,
  splitRatio,
  onToggleStream,
  onTakeSnapshot,
  onToggleMirror,
  onToggleGrid,
  onRotate90,
  onToggleCompare,
  onSplitRatioChange,
  onRemoteFlipPhone,
  onRemoteToggleTorch,
  onRemoteToggleMic,
  snapshots,
  onDownloadSnapshot,
  onRemoveSnapshot,
  pairingCode,
  bridgeStatus,
  bridgeStatusText,
  onRefreshPairingCode,
  onOpenPhoneModeHere,
  onOpenUsbHelp,
  onClearStreamError,
}: LivePreviewStageProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const isPhoneStream = Boolean(selectedDevice?.id.startsWith('webrtc-phone-'));
  const customBaseUrl =
    typeof window !== 'undefined'
      ? localStorage.getItem('dropcam.publicBaseUrl') || window.location.origin
      : '';
  const pairUrl = pairingCode
    ? `${customBaseUrl.replace(/\/$/, '')}/?phone=${pairingCode}`
    : '';

  useEffect(() => {
    if (!pairUrl || isStreaming) return;
    void QRCode.toDataURL(pairUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#0C111A', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [pairUrl, isStreaming]);

  const modeSummary = isPhoneStream
    ? 'Телефон Wi-Fi + ПО корекція'
    : metrics.hardwareControlsCount > 0 && metrics.softwareControlsCount > 0
    ? 'Гібридне керування (Драйвер + ПО)'
    : metrics.hardwareControlsCount > 0
    ? 'Апаратне керування драйвером'
    : 'Програмна корекція потоку';

  const copyPairLink = async () => {
    if (!pairUrl) return;
    try {
      await navigator.clipboard.writeText(pairUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <section className="flex-1 min-w-0 bg-[#0C111A] flex flex-col p-4 lg:p-5 gap-4 overflow-y-auto">
      {/* Top stream metadata bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-[#E8EDF5] truncate">
            {selectedDevice ? selectedDevice.name : 'Очікування підключення камери'}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#8D9BAD]">
            <span
              className={
                streamError
                  ? 'text-[#F87171] font-medium'
                  : isStreaming
                  ? 'text-[#4ADE80] font-medium'
                  : 'text-[#8D9BAD]'
              }
            >
              {streamError
                ? 'Помилка потоку'
                : isStarting
                ? 'Запуск камери…'
                : isStreaming
                ? 'Потік активний'
                : 'Очікування сигналу'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {metrics.active
                ? `${metrics.actualWidth} × ${metrics.actualHeight}`
                : `${settings.width} × ${settings.height}`}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {metrics.active
                ? `${metrics.measuredFps.toFixed(1)} FPS`
                : `${settings.frameRate} FPS`}
            </span>
            <span aria-hidden="true">·</span>
            <span>{modeSummary}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleStream}
            disabled={!selectedDevice || isStarting}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
              isStreaming
                ? 'bg-[#263548] hover:bg-[#31445C] text-[#E8EDF5] border border-[#3A4A60]'
                : 'bg-[#3B82F6] hover:bg-[#2563EB] text-white'
            }`}
          >
            {isStreaming ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Зупинити</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Запустити потік</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onTakeSnapshot}
            disabled={!isStreaming}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#1A2434] hover:bg-[#233044] text-[#E8EDF5] border border-[#2C3B52] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Фотознімок</span>
          </button>
        </div>
      </div>

      {/* Main video canvas viewport / Quick DropCam pairing stage */}
      <div className="relative flex-1 min-h-[380px] lg:min-h-[450px] rounded-xl bg-[#070A10] border border-[#233044] overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!isPhoneStream || !settings.micEnabled}
          className="sr-only"
          aria-hidden="true"
        />

        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full w-auto h-auto object-contain ${
            isStreaming ? 'block' : 'hidden'
          }`}
        />

        {!isStreaming && (
          <div className="w-full max-w-2xl p-6">
            {streamError ? (
              <div className="max-w-md mx-auto text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#261619] border border-[#DC2626]/40 mx-auto flex items-center justify-center">
                  <Camera className="w-6 h-6 text-[#F87171]" />
                </div>
                <p className="text-sm font-semibold text-[#F87171]">
                  Не вдалося відкрити відеопотік
                </p>
                <p className="text-xs text-[#9AA8BC] leading-relaxed">
                  {streamError}
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  {selectedDevice && (
                    <button
                      type="button"
                      onClick={onToggleStream}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg cursor-pointer"
                    >
                      Спробувати знову
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClearStreamError}
                    className="px-3.5 py-2 text-xs font-semibold bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] text-[#E8EDF5] rounded-lg cursor-pointer"
                  >
                    Повернутися до QR / Підключення
                  </button>
                </div>
              </div>
            ) : isStarting ? (
              <div className="text-center space-y-2">
                <p className="text-sm text-[#C7D3E3]">
                  Ініціалізація відеопотоку з камери…
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-[#131C29] border border-[#233044] p-5 grid grid-cols-1 md:grid-cols-[190px_1fr] gap-5 items-center">
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[#0C111A] border border-[#233044]">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR-код DropCam для підключення телефона"
                      className="w-40 h-40 rounded bg-white p-1"
                    />
                  ) : bridgeStatus === 'error' ? (
                    <div className="w-40 h-40 rounded bg-[#1A2434] flex flex-col items-center justify-center gap-2 text-xs text-[#9AA8BC] text-center px-3">
                      <Smartphone className="w-6 h-6 text-[#6D7E96]" />
                      <span>Локальний режим (.exe)</span>
                    </div>
                  ) : (
                    <div className="w-40 h-40 rounded bg-[#1A2434] flex items-center justify-center text-xs text-[#8D9BAD] text-center px-2">
                      Генерація QR…
                    </div>
                  )}
                  <div className="font-mono text-lg font-bold tracking-widest tabular-nums text-[#E8EDF5]">
                    {pairingCode || '——————'}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#60A5FA]" />
                    <h2 className="text-sm font-bold text-[#E8EDF5]">
                      Підключіть телефон як вебкамеру (DropCam)
                    </h2>
                  </div>
                  <p className="text-xs text-[#9AA8BC] leading-relaxed">
                    Відскануйте QR-код камерою телефона або відкрийте посилання нижче на смартфоні, щоб передавати відео з передньої чи задньої камери у це вікно.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pairUrl}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-[#070A10] border border-[#233044] rounded text-[#C7D3E3]"
                    />
                    <button
                      type="button"
                      onClick={() => void copyPairLink()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded text-[#E8EDF5] cursor-pointer shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                          <span>Ок</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Копіювати</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <span className="text-[#60A5FA]">{bridgeStatusText}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onRefreshPairingCode}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded text-[#E8EDF5] cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Оновити код</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenUsbHelp}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded text-[#E8EDF5] cursor-pointer"
                      >
                        <span>Підключення по USB</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-[#233044] flex items-center justify-between text-[11px] text-[#8D9BAD]">
                    <span>Або перетворіть поточний пристрій на камеру:</span>
                    <button
                      type="button"
                      onClick={onOpenPhoneModeHere}
                      className="text-[#60A5FA] hover:text-[#93C5FD] font-semibold cursor-pointer"
                    >
                      Режим передавача →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview manipulation + DropCam remote phone controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRotate90}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.rotation !== 0
                ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                : 'bg-[#131C29] border-[#233044] text-[#A3B1C6] hover:text-[#E8EDF5]'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Повернути ({settings.rotation}°)</span>
          </button>

          <button
            type="button"
            onClick={onToggleMirror}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.mirror
                ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                : 'bg-[#131C29] border-[#233044] text-[#A3B1C6] hover:text-[#E8EDF5]'
            }`}
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
            <span>Дзеркало</span>
          </button>

          <button
            type="button"
            onClick={onToggleGrid}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.showGrid
                ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                : 'bg-[#131C29] border-[#233044] text-[#A3B1C6] hover:text-[#E8EDF5]'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Сітка</span>
          </button>

          <button
            type="button"
            onClick={onToggleCompare}
            disabled={!isStreaming}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 ${
              compareSplit
                ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                : 'bg-[#131C29] border-[#233044] text-[#A3B1C6] hover:text-[#E8EDF5]'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>До / Після</span>
          </button>

          {isPhoneStream && (
            <>
              <button
                type="button"
                onClick={onRemoteFlipPhone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#2C3B52] bg-[#1A2434] hover:bg-[#233044] text-[#E8EDF5] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Перемкнути об&apos;єктив</span>
              </button>

              <button
                type="button"
                onClick={onRemoteToggleTorch}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.torch
                    ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                    : 'bg-[#131C29] border-[#233044] text-[#A3B1C6] hover:text-[#E8EDF5]'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" />
                <span>Спалах</span>
              </button>

              <button
                type="button"
                onClick={onRemoteToggleMic}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.micEnabled
                    ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                    : 'bg-[#131C29] border-[#233044] text-[#A3B1C6] hover:text-[#E8EDF5]'
                }`}
              >
                {settings.micEnabled ? (
                  <Mic className="w-3.5 h-3.5" />
                ) : (
                  <MicOff className="w-3.5 h-3.5" />
                )}
                <span>Мікрофон</span>
              </button>
            </>
          )}
        </div>

        {compareSplit && isStreaming && (
          <div className="flex items-center gap-2.5 text-xs text-[#9AA8BC]">
            <span>Межа порівняння</span>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.01}
              value={splitRatio}
              onChange={(e) => onSplitRatioChange(Number(e.target.value))}
              className="studio-slider w-28"
              aria-label="Позиція лінії порівняння До і Після"
            />
          </div>
        )}
      </div>

      {/* Recent snapshots gallery */}
      {snapshots.length > 0 && (
        <div className="border-t border-[#233044] pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#C7D3E3]">
              Останні фотознімки ({snapshots.length})
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="shrink-0 w-40 rounded-lg border border-[#233044] bg-[#131C29] overflow-hidden"
              >
                <img
                  src={snap.dataUrl}
                  alt={`Знімок ${snap.cameraName}`}
                  className="w-full h-22 object-cover bg-[#070A10]"
                />
                <div className="p-2 flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono tabular-nums text-[#C7D3E3] truncate">
                      {snap.width}×{snap.height}
                    </div>
                    <div className="text-[10px] text-[#8D9BAD] truncate">
                      {snap.timestamp}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDownloadSnapshot(snap)}
                      title="Завантажити PNG"
                      className="p-1 text-[#A3B1C6] hover:text-white rounded hover:bg-[#233044] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSnapshot(snap.id)}
                      title="Видалити"
                      className="p-1 text-[#A3B1C6] hover:text-[#F87171] rounded hover:bg-[#233044] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
