import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Flashlight,
  Mic,
  MicOff,
  RefreshCw,
  Smartphone,
  Square,
  Video,
} from 'lucide-react';
import { PhoneCameraSender } from '../services/phoneBridge';
import { translateCameraError } from '../services/cameraEngine';
import { PhoneRemoteCommand } from '../types/camera';

interface PhoneTransmitterViewProps {
  initialCode?: string;
  onExitPhoneMode: () => void;
}

interface PhoneLens {
  deviceId: string;
  label: string;
}

const PHONE_RESOLUTIONS = [
  { label: 'Full HD (1920 × 1080)', width: 1920, height: 1080 },
  { label: 'HD (1280 × 720)', width: 1280, height: 720 },
  { label: 'SD (640 × 480)', width: 640, height: 480 },
];

export function PhoneTransmitterView({
  initialCode = '',
  onExitPhoneMode,
}: PhoneTransmitterViewProps) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [selectedLensId, setSelectedLensId] = useState<string>('');
  const [lenses, setLenses] = useState<PhoneLens[]>([]);
  const [resIdx, setResIdx] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [status, setStatus] = useState('Готово до запуску камери');
  const [isError, setIsError] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaired, setIsPaired] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const senderRef = useRef<PhoneCameraSender | null>(null);
  const facingRef = useRef(facing);
  const resIdxRef = useRef(resIdx);
  facingRef.current = facing;
  resIdxRef.current = resIdx;

  const stopCamera = useCallback(() => {
    senderRef.current?.stop();
    senderRef.current = null;
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsPaired(false);
  }, []);

  const applyTorch = useCallback(async (enabled: boolean) => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: enabled } as MediaTrackConstraintSet],
      });
      setTorchOn(enabled);
    } catch {
      setStatus('Ліхтарик не підтримується поточним об’єктивом');
    }
  }, []);

  const applyMic = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current = null;
      }
      await senderRef.current?.setAudioTrack(null);
      setMicOn(false);
      return;
    }
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const track = audioStream.getAudioTracks()[0] || null;
      audioTrackRef.current = track;
      if (track && streamRef.current) {
        streamRef.current.addTrack(track);
      }
      await senderRef.current?.setAudioTrack(track);
      setMicOn(Boolean(track));
    } catch (err) {
      setStatus(translateCameraError(err));
      setMicOn(false);
    }
  }, []);

  const startLocalPhoneCamera = useCallback(
    async (
      targetFacing: 'environment' | 'user',
      lensId: string,
      resolutionIndex: number
    ) => {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => t.stop());
      }
      setIsError(false);
      setStatus('Запуск камери телефона…');
      const preset = PHONE_RESOLUTIONS[resolutionIndex] || PHONE_RESOLUTIONS[1];

      try {
        const videoConstraints: MediaTrackConstraints = lensId
          ? {
              deviceId: { exact: lensId },
              width: { ideal: preset.width },
              height: { ideal: preset.height },
            }
          : {
              facingMode: { ideal: targetFacing },
              width: { ideal: preset.width },
              height: { ideal: preset.height },
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        });

        if (audioTrackRef.current) {
          stream.addTrack(audioTrackRef.current);
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setIsStreaming(true);
        setTorchOn(false);

        const enumerated = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = enumerated
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Камера ${i + 1}`,
          }));
        setLenses(videoInputs);

        const newTrack = stream.getVideoTracks()[0];
        if (newTrack && senderRef.current) {
          await senderRef.current.replaceVideoTrack(newTrack);
        }

        const settings = newTrack?.getSettings();
        setStatus(
          `Камера активна (${settings?.width || preset.width}×${
            settings?.height || preset.height
          })`
        );
      } catch (err) {
        setIsError(true);
        setStatus(translateCameraError(err));
        setIsStreaming(false);
      }
    },
    []
  );

  const handleRemoteCommand = useCallback(
    (cmd: PhoneRemoteCommand) => {
      if (cmd.action === 'flip-camera') {
        const nextFacing = facingRef.current === 'environment' ? 'user' : 'environment';
        setFacing(nextFacing);
        setSelectedLensId('');
        void startLocalPhoneCamera(nextFacing, '', resIdxRef.current);
      } else if (cmd.action === 'set-torch') {
        void applyTorch(cmd.enabled);
      } else if (cmd.action === 'set-mic') {
        void applyMic(cmd.enabled);
      } else if (cmd.action === 'set-resolution') {
        const idx = PHONE_RESOLUTIONS.findIndex(
          (r) => r.width === cmd.width && r.height === cmd.height
        );
        const resolvedIdx = idx >= 0 ? idx : 1;
        setResIdx(resolvedIdx);
        void startLocalPhoneCamera(facingRef.current, '', resolvedIdx);
      }
    },
    [applyMic, applyTorch, startLocalPhoneCamera]
  );

  useEffect(() => {
    void startLocalPhoneCamera(facing, selectedLensId, resIdx);
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectWithCode = useCallback(
    async (rawCode: string) => {
      const cleanCode = rawCode.toUpperCase().trim();
      if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
        setIsError(true);
        setStatus('Введіть коректний 6-символьний код із вікна DropCam на ПК.');
        return;
      }

      if (!streamRef.current) {
        await startLocalPhoneCamera(facing, selectedLensId, resIdx);
      }
      if (!streamRef.current) return;

      senderRef.current?.stop();
      const sender = new PhoneCameraSender(
        cleanCode,
        (msg, err) => {
          setStatus(msg);
          setIsError(Boolean(err));
        },
        handleRemoteCommand
      );
      senderRef.current = sender;

      try {
        const ua = navigator.userAgent;
        const label = ua.includes('Android')
          ? 'Android Камера (DropCam)'
          : ua.includes('iPhone')
          ? 'iPhone Камера (DropCam)'
          : 'Смартфон (DropCam Wi-Fi)';
        await sender.connect(streamRef.current, label);
        setIsPaired(true);
      } catch (err) {
        setIsError(true);
        setStatus(err instanceof Error ? err.message : String(err));
        setIsPaired(false);
      }
    },
    [facing, handleRemoteCommand, resIdx, selectedLensId, startLocalPhoneCamera]
  );

  // Auto-connect if launched via QR code (?phone=CODE)
  useEffect(() => {
    if (/^[A-Z0-9]{6}$/.test(initialCode.toUpperCase()) && isStreaming && !isPaired) {
      void connectWithCode(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const handleFlipCamera = () => {
    const nextFacing = facing === 'environment' ? 'user' : 'environment';
    setFacing(nextFacing);
    setSelectedLensId('');
    void startLocalPhoneCamera(nextFacing, '', resIdx);
  };

  return (
    <div className="min-h-screen bg-[#0C111A] text-[#E8EDF5] flex flex-col">
      <header className="h-14 border-b border-[#233044] px-4 flex items-center justify-between gap-3 bg-[#131C29]">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-[#60A5FA]" />
          <span className="font-display font-bold text-base">
            DropCam · Камера телефона
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onExitPhoneMode();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A2434] border border-[#2C3B52] rounded-lg text-[#C7D3E3] hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>На ПК-інтерфейс</span>
        </button>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col gap-4">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#070A10] border border-[#233044] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <Camera className="w-8 h-8 text-[#6D7E96]" />
              <p className="text-xs text-[#9AA8BC]">Камера ще не запущена</p>
            </div>
          )}
        </div>

        <div
          className={`p-3 rounded-lg border text-xs ${
            isError
              ? 'bg-[#261619] border-[#DC2626]/50 text-[#FCA5A5]'
              : isPaired
              ? 'bg-[#13251E] border-[#16A34A]/50 text-[#86EFAC]'
              : 'bg-[#131C29] border-[#233044] text-[#C7D3E3]'
          }`}
        >
          {status}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void connectWithCode(code);
          }}
          className="p-4 rounded-xl bg-[#131C29] border border-[#233044] space-y-3"
        >
          <label className="block text-xs font-semibold text-[#E8EDF5]">
            Код підключення до ПК
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Напр. A7K9M2"
              className="flex-1 px-3 py-2.5 text-sm font-mono tracking-widest uppercase bg-[#0C111A] border border-[#2C3B52] rounded-lg text-[#E8EDF5] focus:outline-none focus:border-[#3B82F6]"
            />
            {isPaired ? (
              <button
                type="button"
                onClick={() => {
                  senderRef.current?.stop();
                  senderRef.current = null;
                  setIsPaired(false);
                  setStatus('Трансляцію на ПК зупинено');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Стоп</span>
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Транслювати</span>
              </button>
            )}
          </div>
        </form>

        <div className="p-4 rounded-xl bg-[#131C29] border border-[#233044] space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFlipCamera}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#1A2434] hover:bg-[#233044] border border-[#2C3B52] rounded-lg text-[#E8EDF5] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                {facing === 'environment' ? 'Передня камера' : 'Тильна камера'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void applyTorch(!torchOn)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                torchOn
                  ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                  : 'bg-[#1A2434] border-[#2C3B52] text-[#C7D3E3]'
              }`}
            >
              <Flashlight className="w-3.5 h-3.5" />
              <span>Спалах</span>
            </button>

            <button
              type="button"
              onClick={() => void applyMic(!micOn)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                micOn
                  ? 'bg-[#1E3A5F] border-[#3B82F6] text-[#E8EDF5]'
                  : 'bg-[#1A2434] border-[#2C3B52] text-[#C7D3E3]'
              }`}
            >
              {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>Мікрофон</span>
            </button>
          </div>

          {lenses.length > 1 && (
            <div>
              <label className="block text-[11px] text-[#8D9BAD] mb-1">
                Об&apos;єктив телефона
              </label>
              <select
                value={selectedLensId}
                onChange={(e) => {
                  setSelectedLensId(e.target.value);
                  void startLocalPhoneCamera(facing, e.target.value, resIdx);
                }}
                className="w-full px-3 py-2 text-xs bg-[#0C111A] border border-[#2C3B52] rounded-lg text-[#E8EDF5]"
              >
                <option value="">
                  Автоматично ({facing === 'environment' ? 'тильна' : 'передня'})
                </option>
                {lenses.map((lens) => (
                  <option key={lens.deviceId} value={lens.deviceId}>
                    {lens.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-[#8D9BAD] mb-1">
              Роздільна здатність передачі
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PHONE_RESOLUTIONS.map((r, idx) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => {
                    setResIdx(idx);
                    void startLocalPhoneCamera(facing, selectedLensId, idx);
                  }}
                  className={`py-2 px-2 text-xs font-mono rounded-lg border cursor-pointer ${
                    resIdx === idx
                      ? 'bg-[#3B82F6] border-[#3B82F6] text-white font-semibold'
                      : 'bg-[#0C111A] border-[#233044] text-[#C7D3E3]'
                  }`}
                >
                  {r.width}×{r.height}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
