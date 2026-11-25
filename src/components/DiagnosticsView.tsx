import { Activity, Download, Play } from 'lucide-react';
import {
  AppRuntimeInfo,
  CameraCapabilities,
  CameraDevice,
  CameraSettings,
  DiagnosticLogEntry,
  StreamMetrics,
} from '../types/camera';

interface DiagnosticsViewProps {
  runtimeInfo: AppRuntimeInfo;
  devices: CameraDevice[];
  selectedDevice: CameraDevice | null;
  capabilities: CameraCapabilities;
  settings: CameraSettings;
  metrics: StreamMetrics;
  logs: DiagnosticLogEntry[];
  onRunDiagnosticCheck: () => void;
}

export function DiagnosticsView({
  runtimeInfo,
  devices,
  selectedDevice,
  capabilities,
  settings,
  metrics,
  logs,
  onRunDiagnosticCheck,
}: DiagnosticsViewProps) {
  const controlList = Object.values(capabilities.controls);

  const handleExportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      runtime: runtimeInfo,
      detectedDevicesCount: devices.length,
      devices,
      activeDevice: selectedDevice,
      streamMetrics: metrics,
      currentSettings: settings,
      capabilities: controlList,
      recentLogs: logs.slice(0, 50),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camcontrol-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0C111A] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#233044] pb-5">
          <div>
            <h1 className="text-xl font-bold text-[#E8EDF5]">
              Діагностика камери та відеопотоку
            </h1>
            <p className="mt-1 text-sm text-[#8D9BAD]">
              Перевірка фактичної частоти кадрів, узгодженої роздільної здатності та матриці апаратних можливостей драйвера.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRunDiagnosticCheck}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Запустити перевірку</span>
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#E8EDF5] bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Експортувати звіт JSON</span>
            </button>
          </div>
        </div>

        {/* Summary metrics grid - single level depth */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#131C29] border border-[#233044]">
            <div className="text-xs text-[#8D9BAD]">Фактичний FPS</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#E8EDF5]">
              {metrics.active ? metrics.measuredFps.toFixed(1) : '—'}
            </div>
            <div className="mt-1 text-xs text-[#8D9BAD] font-mono tabular-nums">
              Ціль: {settings.frameRate} FPS · {metrics.active ? `${metrics.frameTimeMs.toFixed(1)} мс/кадр` : 'потік зупинено'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131C29] border border-[#233044]">
            <div className="text-xs text-[#8D9BAD]">Роздільна здатність</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#E8EDF5]">
              {metrics.active
                ? `${metrics.actualWidth}×${metrics.actualHeight}`
                : `${settings.width}×${settings.height}`}
            </div>
            <div className="mt-1 text-xs text-[#8D9BAD]">
              Співвідношення: {metrics.aspectRatio}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131C29] border border-[#233044]">
            <div className="text-xs text-[#8D9BAD]">Оброблено кадрів</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#E8EDF5]">
              {metrics.totalFrames}
            </div>
            <div className="mt-1 text-xs text-[#8D9BAD] font-mono tabular-nums">
              Пропущено: {metrics.droppedFrames}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131C29] border border-[#233044]">
            <div className="text-xs text-[#8D9BAD]">Середовище та Backend</div>
            <div className="mt-2 text-base font-semibold text-[#E8EDF5] truncate">
              {runtimeInfo.platform}
            </div>
            <div className="mt-1 text-xs text-[#8D9BAD] truncate">
              {runtimeInfo.backendName}
            </div>
          </div>
        </div>

        {/* Capabilities matrix */}
        <div className="rounded-xl bg-[#131C29] border border-[#233044] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#233044] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#E8EDF5]">
              Матриця параметрів камери ({selectedDevice ? selectedDevice.name : 'не обрано'})
            </h2>
            <span className="text-xs text-[#8D9BAD]">
              Апаратно: {metrics.hardwareControlsCount} · Програмно: {metrics.softwareControlsCount}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#233044] text-xs text-[#8D9BAD]">
                  <th className="py-3 px-5 font-medium">Параметр</th>
                  <th className="py-3 px-4 font-medium">Режим керування</th>
                  <th className="py-3 px-4 font-medium text-right">Поточне значення</th>
                  <th className="py-3 px-5 font-medium text-right">Діапазон драйвера (min / max / step)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233044] text-xs">
                {controlList.map((cap) => (
                  <tr key={cap.key} className="hover:bg-[#172130] transition-colors">
                    <td className="py-2.5 px-5 font-medium text-[#E8EDF5]">
                      {cap.label}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={
                          cap.mode === 'hardware'
                            ? 'text-[#4ADE80] font-medium'
                            : 'text-[#F59E0B] font-medium'
                        }
                      >
                        {cap.mode === 'hardware'
                          ? 'Апаратний (Драйвер камери)'
                          : 'Програмний (Обробка кадрів)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#E8EDF5]">
                      {cap.key === 'zoom'
                        ? settings[cap.key].toFixed(2)
                        : Math.round(settings[cap.key])}{' '}
                      {cap.unit}
                    </td>
                    <td className="py-2.5 px-5 text-right font-mono tabular-nums text-[#8D9BAD]">
                      {cap.hardwareSupported
                        ? `${cap.hardwareMin} / ${cap.hardwareMax} / ${cap.hardwareStep ?? '—'}`
                        : 'Не експортується драйвером'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live event log */}
        <div className="rounded-xl bg-[#131C29] border border-[#233044] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#233044] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#60A5FA]" />
            <h2 className="text-sm font-semibold text-[#E8EDF5]">
              Журнал подій та перевірок
            </h2>
          </div>

          <div className="divide-y divide-[#233044] max-h-72 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8D9BAD]">
                Подій ще не зафіксовано.
              </div>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  className="px-5 py-2.5 flex items-baseline gap-4 text-xs"
                >
                  <span className="font-mono tabular-nums text-[#6D7E96] shrink-0">
                    {entry.timestamp}
                  </span>
                  <span
                    className={`font-medium shrink-0 w-16 ${
                      entry.level === 'error'
                        ? 'text-[#F87171]'
                        : entry.level === 'warning'
                        ? 'text-[#F59E0B]'
                        : entry.level === 'success'
                        ? 'text-[#4ADE80]'
                        : 'text-[#60A5FA]'
                    }`}
                  >
                    {entry.source}
                  </span>
                  <span className="text-[#C7D3E3]">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
