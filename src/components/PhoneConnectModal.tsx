import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Smartphone,
  Usb,
  Wifi,
  X,
} from 'lucide-react';

interface PhoneConnectModalProps {
  isOpen: boolean;
  initialTab?: 'wifi' | 'usb';
  onClose: () => void;
  pairingCode: string | null;
  bridgeStatus: 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';
  bridgeStatusText: string;
  onCreatePairingSession: () => void;
  onRefreshUsbDevices: () => void;
  isScanning: boolean;
  onOpenPhoneModeHere: () => void;
}

const PUBLIC_BASE_URL_KEY = 'dropcam.publicBaseUrl';

export function PhoneConnectModal({
  isOpen,
  initialTab = 'wifi',
  onClose,
  pairingCode,
  bridgeStatus,
  bridgeStatusText,
  onCreatePairingSession,
  onRefreshUsbDevices,
  isScanning,
  onOpenPhoneModeHere,
}: PhoneConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'wifi' | 'usb'>(initialTab);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(PUBLIC_BASE_URL_KEY) || window.location.origin;
    } catch {
      return window.location.origin;
    }
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const cleanBase = (customBaseUrl || window.location.origin).trim().replace(/\/$/, '');
  const pairUrl = pairingCode ? `${cleanBase}/?phone=${pairingCode}` : '';
  const isInsideIframe = window.top !== window.self;

  useEffect(() => {
    if (!isOpen) return;
    if (!pairingCode && activeTab === 'wifi') {
      onCreatePairingSession();
    }
  }, [isOpen, pairingCode, activeTab, onCreatePairingSession]);

  useEffect(() => {
    if (!pairUrl) {
      setQrDataUrl('');
      return;
    }
    void QRCode.toDataURL(pairUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0C111A',
        light: '#FFFFFF',
      },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [pairUrl]);

  if (!isOpen) return null;

  const handleBaseUrlChange = (val: string) => {
    setCustomBaseUrl(val);
    try {
      localStorage.setItem(PUBLIC_BASE_URL_KEY, val);
    } catch {
      // ignore storage failure
    }
  };

  const copyLink = async () => {
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
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl bg-[#131C29] border border-[#2C3B52] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[#233044] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#60A5FA]" />
            <h2 id="phone-modal-title" className="text-base font-bold text-[#E8EDF5]">
              Підключити телефон до DropCam
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8D9BAD] hover:text-white hover:bg-[#1A2434] cursor-pointer"
            aria-label="Закрити вікно"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 border-b border-[#233044] flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('wifi')}
            className={`pb-3 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'wifi'
                ? 'border-[#3B82F6] text-[#E8EDF5]'
                : 'border-transparent text-[#8D9BAD] hover:text-[#E8EDF5]'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Wi-Fi / QR-код</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('usb')}
            className={`pb-3 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'usb'
                ? 'border-[#3B82F6] text-[#E8EDF5]'
                : 'border-transparent text-[#8D9BAD] hover:text-[#E8EDF5]'
            }`}
          >
            <Usb className="w-3.5 h-3.5" />
            <span>USB-кабель (Android / iPhone)</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'wifi' ? (
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 items-start">
              <div className="flex flex-col items-center gap-2.5 p-3 rounded-xl bg-[#0C111A] border border-[#233044]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR-код для підключення камери смартфона"
                    className="w-44 h-44 rounded-lg bg-white p-1"
                  />
                ) : (
                  <div className="w-44 h-44 rounded-lg bg-[#1A2434] flex items-center justify-center text-xs text-[#8D9BAD] text-center px-3">
                    Генерація коду сполучення…
                  </div>
                )}
                <div className="text-center">
                  <div className="text-[11px] text-[#8D9BAD]">Код сполучення</div>
                  <div className="font-mono text-xl font-bold tracking-widest tabular-nums text-[#E8EDF5]">
                    {pairingCode || '——————'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#C7D3E3] leading-relaxed">
                  Відскануйте QR-код телефоном або відкрийте посилання на смартфоні — ви отримаєте повноцінне керування камерою, спалахом, перемиканням об&apos;єктива, поворотом, зумом та мікрофоном.
                </p>

                <div className="p-3 rounded-lg bg-[#0F1723] border border-[#233044] space-y-2">
                  <div className="text-[11px] text-[#8D9BAD]">
                    Базова адреса (можна вставити Shared URL для входу з телефона)
                  </div>
                  <input
                    type="url"
                    value={customBaseUrl}
                    onChange={(e) => handleBaseUrlChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#070A10] border border-[#233044] rounded text-[#C7D3E3] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pairUrl}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-[#070A10] border border-[#233044] rounded text-[#8D9BAD]"
                    />
                    <button
                      type="button"
                      onClick={() => void copyLink()}
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
                </div>

                <div className="p-3 rounded-lg bg-[#0F1723] border border-[#233044] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-[#8D9BAD]">Стан підключення</div>
                    <div
                      className={`text-xs font-medium mt-0.5 ${
                        bridgeStatus === 'connected'
                          ? 'text-[#4ADE80]'
                          : bridgeStatus === 'error'
                          ? 'text-[#F87171]'
                          : 'text-[#60A5FA]'
                      }`}
                    >
                      {bridgeStatusText}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onCreatePairingSession}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded-lg text-[#E8EDF5] cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Новий код</span>
                  </button>
                </div>

                <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8D9BAD]">
                  <span>Відкрили сторінку прямо на телефоні?</span>
                  <button
                    type="button"
                    onClick={onOpenPhoneModeHere}
                    className="text-[#60A5FA] hover:text-[#93C5FD] font-semibold cursor-pointer"
                  >
                    Увімкнути режим камери телефона тут →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-[#C7D3E3] leading-relaxed">
              <div className="p-3.5 rounded-lg bg-[#0F1723] border border-[#233044] space-y-1.5">
                <div className="font-semibold text-[#E8EDF5]">
                  Як підключити телефон по USB-кабелю:
                </div>
                <p className="text-[#9AA8BC]">
                  Браузер у веб-режимі не має прямого доступу до протоколу Android ADB, тому по кабелю телефон має працювати в режимі UVC-вебкамери або через системний міст Windows:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-lg bg-[#0F1723] border border-[#233044]">
                  <div className="font-semibold text-[#E8EDF5]">
                    1. Android 14+ — вбудований режим «Вебкамера» по USB
                  </div>
                  <p className="mt-1 text-[#9AA8BC]">
                    Підключіть USB-кабель → відкрийте шторку сповіщень → натисніть «Заряджання через USB» → оберіть <strong className="text-[#E8EDF5]">«Вебкамера»</strong> → натисніть «Перевірити камери».
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0F1723] border border-[#233044]">
                  <div className="font-semibold text-[#E8EDF5]">
                    2. Windows 11 — «Зв&apos;язок зі смартфоном» (Phone Link)
                  </div>
                  <p className="mt-1 text-[#9AA8BC]">
                    Параметри Windows → Bluetooth і пристрої → Мобільні пристрої → увімкніть «Використовувати як підключену камеру».
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0F1723] border border-[#233044]">
                  <div className="font-semibold text-[#E8EDF5]">
                    3. Нативна збірка Windows `.exe` (Tauri + ADB)
                  </div>
                  <p className="mt-1 text-[#9AA8BC]">
                    У зібраній Windows-програмі (`src-tauri`) також підтримується перевірка підключених Android-пристроїв через USB Debugging (`adb devices`).
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                {isInsideIframe ? (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#60A5FA] hover:text-[#93C5FD]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Відкрити в окремій вкладці</span>
                  </a>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={onRefreshUsbDevices}
                  disabled={isScanning}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>Перевірити камери</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
