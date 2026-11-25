import { useState } from 'react';
import { Check, Copy, Download, MonitorCog, Terminal } from 'lucide-react';
import { AppRuntimeInfo } from '../types/camera';

interface WindowsBuildViewProps {
  runtimeInfo: AppRuntimeInfo;
}

const LOCAL_BUILD_COMMAND = `npm install
npm run build
cargo tauri build --bundles msi,nsis`;

const GITHUB_RELEASE_COMMAND = `git add .
git commit -m "Release CamControl Windows installer"
git tag v1.0.0
git push origin main --tags`;

const TAURI_CONF_SNIPPET = `{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "DropCam",
  "version": "1.0.0",
  "identifier": "dev.dropcam.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:3000",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "DropCam — Налаштування камер",
        "width": 1360,
        "height": 840,
        "minWidth": 960,
        "minHeight": 640
      }
    ],
    "withGlobalTauri": true
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"]
  }
}`;

export function WindowsBuildView({ runtimeInfo }: WindowsBuildViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0C111A] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#233044] pb-5">
          <div>
            <h1 className="text-xl font-bold text-[#E8EDF5]">
              Збірка Windows-програми (.exe / .msi)
            </h1>
            <p className="mt-1 text-sm text-[#8D9BAD]">
              Проєкт уже містить готовий нативний бекенд Tauri 2 + Rust (nokhwa / Media Foundation) та сценарій автоматичної збірки інсталятора для Windows 10 і Windows 11.
            </p>
          </div>

          <button
            type="button"
            onClick={() => downloadFile('tauri.conf.json', TAURI_CONF_SNIPPET)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#E8EDF5] bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Завантажити tauri.conf.json</span>
          </button>
        </div>

        {/* Runtime status banner */}
        <div className="p-4 rounded-xl bg-[#131C29] border border-[#233044] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1A2434] border border-[#2C3B52] flex items-center justify-center shrink-0">
              <MonitorCog className="w-5 h-5 text-[#60A5FA]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#E8EDF5]">
                Поточне середовище виконання:{' '}
                <span className="text-[#60A5FA]">
                  {runtimeInfo.mode === 'tauri'
                    ? 'Нативний Windows Tauri 2 (.exe)'
                    : 'Веб-інтерфейс у браузері'}
                </span>
              </div>
              <div className="text-xs text-[#8D9BAD] mt-0.5">
                Платформа: {runtimeInfo.platform} · Backend: {runtimeInfo.backendName}
              </div>
            </div>
          </div>
        </div>

        {/* Two build paths */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-5 rounded-xl bg-[#131C29] border border-[#233044] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#E8EDF5]">
                Спосіб 1: Локальна збірка на Windows 10/11
              </h2>
              <Terminal className="w-4 h-4 text-[#60A5FA]" />
            </div>
            <p className="text-xs text-[#9AA8BC] leading-relaxed">
              Виконайте ці команди в корені експортованого проєкту на ПК з установленим Node.js LTS, Rust (MSVC) та Tauri CLI (`cargo install tauri-cli --version &apos;^2.0.0&apos;`).
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-lg bg-[#070A10] border border-[#233044] font-mono text-xs text-[#C7D3E3] overflow-x-auto leading-relaxed">
                {LOCAL_BUILD_COMMAND}
              </pre>
              <button
                type="button"
                onClick={() => copyText('local', LOCAL_BUILD_COMMAND)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] text-[#C7D3E3] cursor-pointer"
                title="Копіювати команди"
              >
                {copiedId === 'local' ? (
                  <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-xs text-[#8D9BAD] leading-relaxed">
              Готовий інсталятор з&apos;явиться в папці <code className="font-mono text-[#C7D3E3]">src-tauri/target/release/bundle/nsis/CamControl_1.0.0_x64-setup.exe</code> (а також окремий портативний <code className="font-mono text-[#C7D3E3]">CamControl.exe</code> у <code className="font-mono text-[#C7D3E3]">target/release/</code>).
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#131C29] border border-[#233044] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#E8EDF5]">
                Спосіб 2: Автоматична збірка через GitHub Actions
              </h2>
              <Download className="w-4 h-4 text-[#4ADE80]" />
            </div>
            <p className="text-xs text-[#9AA8BC] leading-relaxed">
              Якщо ви не хочете встановлювати Rust і компілятор C++ на свій ПК, завантажте проєкт у GitHub-репозиторій. Workflow <code className="font-mono text-[#C7D3E3]">release-windows.yml</code> збере `.exe` та `.msi` у хмарі безкоштовно.
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-lg bg-[#070A10] border border-[#233044] font-mono text-xs text-[#C7D3E3] overflow-x-auto leading-relaxed">
                {GITHUB_RELEASE_COMMAND}
              </pre>
              <button
                type="button"
                onClick={() => copyText('github', GITHUB_RELEASE_COMMAND)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] text-[#C7D3E3] cursor-pointer"
                title="Копіювати команди"
              >
                {copiedId === 'github' ? (
                  <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-xs text-[#8D9BAD] leading-relaxed">
              Після завершення workflow готовий файл <code className="font-mono text-[#C7D3E3]">CamControl-setup.exe</code> можна завантажити зі сторінки GitHub Releases або вкладки Actions.
            </p>
          </div>
        </div>

        {/* Architecture parity checklist */}
        <div className="p-5 rounded-xl bg-[#131C29] border border-[#233044] space-y-3">
          <h2 className="text-sm font-semibold text-[#E8EDF5]">
            Що реалізовано в нативному Rust-бекенді для Windows (.exe)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#C7D3E3]">
            <div className="p-3 rounded-lg bg-[#0F1723] border border-[#233044]">
              <div className="font-semibold text-[#E8EDF5]">Windows Media Foundation</div>
              <p className="mt-1 text-[#8D9BAD]">
                Виявлення локальних USB/UVC-камер, вбудованих вебкамер ноутбуків та сумісних карт відеозахоплення через крейт nokhwa.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#0F1723] border border-[#233044]">
              <div className="font-semibold text-[#E8EDF5]">UVC-керування параметрами</div>
              <p className="mt-1 text-[#8D9BAD]">
                Команди читання та запису яскравості, контрастності, насиченості, різкості, експозиції, балансу білого, масштабу та фокуса з поверненням фактичних діапазонів.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
