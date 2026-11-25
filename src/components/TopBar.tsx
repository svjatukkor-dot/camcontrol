import { RefreshCw } from 'lucide-react';
import { AppTab } from '../types/camera';

interface TopBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onRefreshCameras: () => void;
  isScanning: boolean;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'studio', label: 'Студія' },
  { id: 'diagnostics', label: 'Діагностика' },
  { id: 'profiles', label: 'Профілі' },
  { id: 'windows-build', label: 'Збірка EXE' },
];

export function TopBar({
  activeTab,
  onTabChange,
  onRefreshCameras,
  isScanning,
}: TopBarProps) {
  return (
    <header className="h-14 border-b border-[#233044] bg-[#0C111A] px-4 lg:px-6 flex items-center justify-between gap-4 lg:gap-8 shrink-0">
      <button
        type="button"
        onClick={() => onTabChange('studio')}
        className="font-display text-lg font-bold tracking-tight text-[#E8EDF5] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3B82F6] rounded"
      >
        DropCam
      </button>

      <nav className="flex items-center gap-4 lg:gap-6 overflow-x-auto" aria-label="Основна навігація">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3B82F6] ${
                isActive
                  ? 'text-[#E8EDF5]'
                  : 'text-[#8D9BAD] hover:text-[#E8EDF5]'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onRefreshCameras}
          disabled={isScanning}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Пошук…' : 'Оновити камери'}</span>
        </button>
      </div>
    </header>
  );
}
