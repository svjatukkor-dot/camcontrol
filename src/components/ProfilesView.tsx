import React, { useRef, useState } from 'react';
import { Check, Download, Search, Trash2, Upload } from 'lucide-react';
import { CameraDevice, CameraProfile } from '../types/camera';
import {
  exportProfilesToJson,
  parseImportedProfilesJson,
} from '../services/profileStorage';

interface ProfilesViewProps {
  profiles: CameraProfile[];
  devices: CameraDevice[];
  activeProfileId: string | null;
  onApplyProfile: (profile: CameraProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onRenameProfile: (profileId: string, newName: string) => void;
  onImportProfiles: (imported: CameraProfile[]) => void;
}

export function ProfilesView({
  profiles,
  devices,
  activeProfileId,
  onApplyProfile,
  onDeleteProfile,
  onRenameProfile,
  onImportProfiles,
}: ProfilesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.cameraName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportAll = () => {
    const json = exportProfilesToJson(profiles);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camcontrol-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingle = (profile: CameraProfile) => {
    const json = exportProfilesToJson([profile]);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camcontrol-${profile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = parseImportedProfilesJson(text);
      if (result.error) {
        setImportFeedback({ type: 'error', text: result.error });
      } else {
        onImportProfiles(result.profiles);
        setImportFeedback({
          type: 'success',
          text: `Успішно імпортовано профілів: ${result.profiles.length}`,
        });
      }
    } catch (err) {
      setImportFeedback({
        type: 'error',
        text: `Не вдалося прочитати файл: ${String(err)}`,
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0C111A] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#233044] pb-5">
          <div>
            <h1 className="text-xl font-bold text-[#E8EDF5]">
              Профілі налаштувань камер
            </h1>
            <p className="mt-1 text-sm text-[#8D9BAD]">
              Збережені конфігурації експозиції, кольору, роздільної здатності та експорт/імпорт у форматі JSON.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#E8EDF5] bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Імпорт JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportAll}
              disabled={profiles.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Експорт усіх ({profiles.length})</span>
            </button>
          </div>
        </div>

        {importFeedback && (
          <div
            className={`p-3.5 rounded-lg border text-xs ${
              importFeedback.type === 'success'
                ? 'bg-[#13251E] border-[#16A34A]/50 text-[#86EFAC]'
                : 'bg-[#261619] border-[#DC2626]/50 text-[#FCA5A5]'
            }`}
          >
            {importFeedback.text}
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-[#6D7E96] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук за назвою профілю або камери…"
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#131C29] border border-[#233044] rounded-lg text-[#E8EDF5] placeholder:text-[#64748B] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 rounded-xl border border-dashed border-[#2C3B52] bg-[#131C29] text-center space-y-2">
            <p className="text-sm font-semibold text-[#E8EDF5]">
              {profiles.length === 0
                ? 'Ще немає збережених профілів'
                : 'Профілів за вашим запитом не знайдено'}
            </p>
            <p className="text-xs text-[#8D9BAD] max-w-md mx-auto">
              Відкрийте вкладку «Студія», налаштуйте потрібну камеру та збережіть конфігурацію, або імпортуйте файл JSON.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-[#131C29] border border-[#233044] divide-y divide-[#233044]">
            {filtered.map((profile) => {
              const isCurrent = profile.id === activeProfileId;
              const isCameraConnected = devices.some(
                (d) =>
                  d.name.toLowerCase() === profile.cameraName.toLowerCase()
              );
              const isEditing = editingId === profile.id;

              return (
                <div
                  key={profile.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#172130] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs bg-[#0C111A] border border-[#3B82F6] rounded text-[#E8EDF5]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingName.trim()) {
                              onRenameProfile(profile.id, editingName.trim());
                            }
                            setEditingId(null);
                          }}
                          className="p-1.5 bg-[#3B82F6] text-white rounded cursor-pointer"
                          title="Підтвердити назву"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(profile.id);
                          setEditingName(profile.name);
                        }}
                        className="text-sm font-semibold text-[#E8EDF5] hover:text-[#60A5FA] transition-colors text-left cursor-pointer"
                        title="Натисніть, щоб перейменувати"
                      >
                        {profile.name}
                      </button>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8D9BAD]">
                      <span>{profile.cameraName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {profile.settings.width}×{profile.settings.height} @ {profile.settings.frameRate} FPS
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Яскр: {profile.settings.brightness}, Контр: {profile.settings.contrast}, Насич: {profile.settings.saturation}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isCameraConnected ? 'text-[#4ADE80]' : 'text-[#8D9BAD]'
                        }
                      >
                        {isCameraConnected ? 'Камера підключена' : 'Камера відключена'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApplyProfile(profile)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'bg-[#1E3A5F] text-[#93C5FD] border border-[#3B82F6]/60'
                          : 'bg-[#3B82F6] hover:bg-[#2563EB] text-white'
                      }`}
                    >
                      {isCurrent ? 'Застосовано' : 'Застосувати'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportSingle(profile)}
                      title="Експортувати цей профіль у JSON"
                      className="p-2 text-[#A3B1C6] hover:text-[#E8EDF5] bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded-lg cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteProfile(profile.id)}
                      title="Видалити профіль"
                      className="p-2 text-[#A3B1C6] hover:text-[#F87171] bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
