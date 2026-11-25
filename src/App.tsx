import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppRuntimeInfo,
  AppTab,
  CameraCapabilities,
  CameraControlKey,
  CameraDevice,
  CameraProfile,
  CameraSettings,
  DiagnosticLogEntry,
  SnapshotItem,
  StreamMetrics,
} from './types/camera';
import {
  DEFAULT_CAMERA_SETTINGS,
  applyHardwareControl,
  buildDefaultCapabilities,
  discoverCameras,
  getRuntimeInfo,
  inspectTrackCapabilities,
  openCameraStream,
  translateCameraError,
} from './services/cameraEngine';
import {
  createProfileRecord,
  findMatchingProfileForDevice,
  getLastSelectedCameraId,
  loadProfiles,
  saveProfiles,
  setLastSelectedCameraId,
} from './services/profileStorage';
import {
  captureCleanSnapshot,
  renderProcessedFrame,
} from './utils/imageProcessor';
import { TopBar } from './components/TopBar';
import { CameraSidebar } from './components/CameraSidebar';
import { LivePreviewStage } from './components/LivePreviewStage';
import { InspectorPanel } from './components/InspectorPanel';
import { DiagnosticsView } from './components/DiagnosticsView';
import { ProfilesView } from './components/ProfilesView';
import { WindowsBuildView } from './components/WindowsBuildView';
import { PhoneConnectModal } from './components/PhoneConnectModal';
import { PhoneTransmitterView } from './components/PhoneTransmitterView';
import {
  HostPhoneReceiver,
  createPhoneBridgeRoom,
} from './services/phoneBridge';

const INITIAL_METRICS: StreamMetrics = {
  active: false,
  actualWidth: 0,
  actualHeight: 0,
  requestedWidth: DEFAULT_CAMERA_SETTINGS.width,
  requestedHeight: DEFAULT_CAMERA_SETTINGS.height,
  measuredFps: 0,
  targetFps: DEFAULT_CAMERA_SETTINGS.frameRate,
  frameTimeMs: 0,
  totalFrames: 0,
  droppedFrames: 0,
  aspectRatio: '16:9',
  hardwareControlsCount: 0,
  softwareControlsCount: 8,
};

function computeAspectRatio(w: number, h: number): string {
  if (!w || !h) return '—';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${Math.round(w / d)}:${Math.round(h / d)}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('studio');
  const [runtimeInfo, setRuntimeInfo] = useState<AppRuntimeInfo>({
    mode: 'web',
    platform: 'Windows',
    architecture: 'x64',
    version: '1.0.0',
    backendName: 'WebRTC MediaDevices / ImageCapture API',
  });

  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [discoveryWarning, setDiscoveryWarning] = useState<string | null>(null);

  const [capabilities, setCapabilities] = useState<CameraCapabilities>(() =>
    buildDefaultCapabilities()
  );
  const [settings, setSettings] = useState<CameraSettings>(DEFAULT_CAMERA_SETTINGS);
  const [profiles, setProfiles] = useState<CameraProfile[]>(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics>(INITIAL_METRICS);

  const [compareSplit, setCompareSplit] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [logs, setLogs] = useState<DiagnosticLogEntry[]>([]);

  // Phone Camera Bridge state
  const [phoneModeCode, setPhoneModeCode] = useState<string | null>(() => {
    const param = new URLSearchParams(window.location.search).get('phone');
    return param !== null ? param.toUpperCase() : null;
  });
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneModalTab, setPhoneModalTab] = useState<'wifi' | 'usb'>('wifi');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<
    'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error'
  >('idle');
  const [bridgeStatusText, setBridgeStatusText] = useState(
    'Очікування створення коду підключення'
  );
  const [phoneDevice, setPhoneDevice] = useState<CameraDevice | null>(null);
  const phoneStreamRef = useRef<MediaStream | null>(null);
  const phoneReceiverRef = useRef<HostPhoneReceiver | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const settingsRef = useRef<CameraSettings>(settings);
  const capabilitiesRef = useRef<CameraCapabilities>(capabilities);
  const compareSplitRef = useRef<boolean>(compareSplit);
  const splitRatioRef = useRef<number>(splitRatio);
  const controlTimersRef = useRef<Partial<Record<CameraControlKey, number>>>({});
  const streamSessionRef = useRef<number>(0);

  settingsRef.current = settings;
  capabilitiesRef.current = capabilities;
  compareSplitRef.current = compareSplit;
  splitRatioRef.current = splitRatio;

  const addLog = useCallback(
    (level: DiagnosticLogEntry['level'], source: string, message: string) => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLogs((prev) => [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp,
          level,
          source,
          message,
        },
        ...prev.slice(0, 99),
      ]);
    },
    []
  );

  const stopActiveStream = useCallback(() => {
    streamSessionRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsStarting(false);
    setMetrics((prev) => ({
      ...prev,
      active: false,
      measuredFps: 0,
      frameTimeMs: 0,
    }));
  }, []);

  const applyAllHardwareControlsForTrack = useCallback(
    async (
      track: MediaStreamTrack,
      caps: CameraCapabilities,
      targetSettings: CameraSettings
    ) => {
      const keys = Object.keys(caps.controls) as CameraControlKey[];
      for (const key of keys) {
        if (caps.controls[key].mode === 'hardware') {
          await applyHardwareControl(
            track,
            key,
            targetSettings[key],
            caps,
            targetSettings
          );
        }
      }
    },
    []
  );

  const startDeviceStream = useCallback(
    async (device: CameraDevice, targetSettings: CameraSettings) => {
      stopActiveStream();
      const session = ++streamSessionRef.current;
      setIsStarting(true);
      setStreamError(null);
      setStatusFeedback(null);

      // Handle remote Wi-Fi WebRTC phone stream
      if (device.id.startsWith('webrtc-phone-')) {
        const remoteStream = phoneStreamRef.current;
        if (!remoteStream) {
          setIsStarting(false);
          setStreamError('Відеопотік із телефона ще не активний або був відключений.');
          return;
        }
        const track = remoteStream.getVideoTracks()[0] || null;
        trackRef.current = track;
        const video = videoRef.current;
        if (video) {
          video.srcObject = remoteStream;
          await video.play().catch(() => {});
        }
        const trackSettings = track?.getSettings();
        const w = trackSettings?.width || 1280;
        const h = trackSettings?.height || 720;
        const fps = Math.round(trackSettings?.frameRate || 30);
        const swCaps = buildDefaultCapabilities();
        setCapabilities(swCaps);
        setSettings((prev) => ({
          ...prev,
          width: w,
          height: h,
          frameRate: fps,
        }));
        setMetrics({
          active: true,
          actualWidth: w,
          actualHeight: h,
          requestedWidth: w,
          requestedHeight: h,
          measuredFps: fps,
          targetFps: fps,
          frameTimeMs: 1000 / Math.max(1, fps),
          totalFrames: 0,
          droppedFrames: 0,
          aspectRatio: computeAspectRatio(w, h),
          hardwareControlsCount: 0,
          softwareControlsCount: Object.keys(swCaps.controls).length,
        });
        setIsStreaming(true);
        setIsStarting(false);
        addLog('success', 'Телефон', `Підключено потік "${device.name}" (${w}×${h}).`);
        return;
      }

      try {
        const result = await openCameraStream(
          device.id,
          targetSettings.width,
          targetSettings.height,
          targetSettings.frameRate
        );

        if (session !== streamSessionRef.current) {
          result.stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = result.stream;
        trackRef.current = result.track;
        setPermissionGranted(true);
        setDiscoveryWarning(null);

        // Handle sudden USB unplugging
        result.track.addEventListener('ended', () => {
          if (session === streamSessionRef.current) {
            stopActiveStream();
            setStreamError('Камеру відключено під час роботи потоку.');
            addLog('error', 'Потік', `Пристрій "${device.name}" раптово відключено.`);
          }
        });

        const video = videoRef.current;
        if (video) {
          video.srcObject = result.stream;
          await video.play().catch(() => {});
        }

        const inspectedCaps = inspectTrackCapabilities(result.track);
        setCapabilities(inspectedCaps);

        const hwCount = Object.values(inspectedCaps.controls).filter(
          (c) => c.mode === 'hardware'
        ).length;
        const swCount = Object.values(inspectedCaps.controls).length - hwCount;

        const nextSettings: CameraSettings = {
          ...targetSettings,
          width: result.negotiatedWidth,
          height: result.negotiatedHeight,
          frameRate: result.negotiatedFps,
        };
        setSettings(nextSettings);

        await applyAllHardwareControlsForTrack(result.track, inspectedCaps, nextSettings);

        setMetrics({
          active: true,
          actualWidth: result.negotiatedWidth,
          actualHeight: result.negotiatedHeight,
          requestedWidth: targetSettings.width,
          requestedHeight: targetSettings.height,
          measuredFps: result.negotiatedFps,
          targetFps: targetSettings.frameRate,
          frameTimeMs: 1000 / Math.max(1, result.negotiatedFps),
          totalFrames: 0,
          droppedFrames: 0,
          aspectRatio: computeAspectRatio(
            result.negotiatedWidth,
            result.negotiatedHeight
          ),
          hardwareControlsCount: hwCount,
          softwareControlsCount: swCount,
        });

        setIsStreaming(true);
        setIsStarting(false);

        if (result.fallbackUsed) {
          addLog(
            'warning',
            'Формат',
            `Запитана роздільна здатність не підтримується; відкрито ${result.negotiatedWidth}×${result.negotiatedHeight} @ ${result.negotiatedFps} FPS.`
          );
        } else {
          addLog(
            'success',
            'Потік',
            `Запущено "${device.name}" (${result.negotiatedWidth}×${result.negotiatedHeight} @ ${result.negotiatedFps} FPS, апаратних параметрів: ${hwCount}).`
          );
        }
      } catch (err) {
        if (session !== streamSessionRef.current) return;
        const msg = translateCameraError(err);
        setStreamError(msg);
        setIsStarting(false);
        setIsStreaming(false);
        addLog('error', 'Потік', `${device.name}: ${msg}`);
      }
    },
    [addLog, applyAllHardwareControlsForTrack, stopActiveStream]
  );

  const handleSelectDevice = useCallback(
    (device: CameraDevice, autoStart = true) => {
      setSelectedDeviceId(device.id);
      setLastSelectedCameraId(device.id);

      const matchedProfile = findMatchingProfileForDevice(profiles, device);
      const nextSettings = matchedProfile
        ? { ...DEFAULT_CAMERA_SETTINGS, ...matchedProfile.settings }
        : { ...DEFAULT_CAMERA_SETTINGS };

      setSettings(nextSettings);
      setActiveProfileId(matchedProfile?.id ?? null);

      if (matchedProfile) {
        addLog(
          'info',
          'Профіль',
          `Автоматично завантажено профіль "${matchedProfile.name}" для ${device.name}.`
        );
      }

      if (autoStart) {
        void startDeviceStream(device, nextSettings);
      }
    },
    [addLog, profiles, startDeviceStream]
  );

  const refreshDeviceList = useCallback(
    async (requestPermission = false) => {
      setIsScanning(true);
      setDiscoveryWarning(null);
      try {
        const res = await discoverCameras(requestPermission);
        setDevices(res.devices);
        setPermissionGranted(res.permissionGranted);
        if (res.warning) {
          setDiscoveryWarning(res.warning);
        }

        addLog(
          'info',
          'Пошук',
          `Виявлено відеопристроїв: ${res.devices.length}.`
        );

        if (selectedDeviceId?.startsWith('webrtc-phone-') && phoneStreamRef.current) {
          // Keep active Wi-Fi phone stream selected during USB device refresh
        } else if (res.devices.length > 0) {
          const currentExists = res.devices.some((d) => d.id === selectedDeviceId);
          if (!currentExists) {
            const lastId = getLastSelectedCameraId();
            const preferred =
              res.devices.find((d) => d.id === lastId) ?? res.devices[0];
            handleSelectDevice(preferred, res.permissionGranted);
          }
        } else if (selectedDeviceId) {
          stopActiveStream();
          setSelectedDeviceId(null);
        }
      } catch (err) {
        const msg = translateCameraError(err);
        setDiscoveryWarning(msg);
        addLog('error', 'Пошук', msg);
      } finally {
        setIsScanning(false);
      }
    },
    [addLog, handleSelectDevice, selectedDeviceId, stopActiveStream]
  );

  // Initial startup & devicechange hot-plug listener
  useEffect(() => {
    void getRuntimeInfo().then(setRuntimeInfo);
    void refreshDeviceList(true);

    const mediaDevices = navigator.mediaDevices;
    const handleDeviceChange = () => {
      addLog('info', 'USB', 'Зафіксовано зміну списку підключених відеопристроїв.');
      void refreshDeviceList(false);
    };

    mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    return () => {
      mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      phoneReceiverRef.current?.stop();
      stopActiveStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePairingSession = useCallback(async () => {
    phoneReceiverRef.current?.stop();
    setBridgeStatus('waiting');
    setBridgeStatusText('Створення коду сполучення…');
    try {
      const room = await createPhoneBridgeRoom();
      setPairingCode(room.code);
      const receiver = new HostPhoneReceiver(room.code, room.hostToken, {
        onStatus: (status, detail) => {
          setBridgeStatus(status);
          setBridgeStatusText(detail);
          if (status === 'disconnected') {
            phoneStreamRef.current = null;
            setPhoneDevice(null);
          }
        },
        onStream: (remoteStream, remoteName) => {
          phoneStreamRef.current = remoteStream;
          const virtualDevice: CameraDevice = {
            id: `webrtc-phone-${room.code}`,
            name: remoteName || 'Смартфон (DropCam Wi-Fi)',
            groupId: 'phone-bridge',
            backend: 'DropCam Wi-Fi',
          };
          setPhoneDevice(virtualDevice);
          setSelectedDeviceId(virtualDevice.id);
          setIsPhoneModalOpen(false);
          setActiveTab('studio');
          void startDeviceStream(virtualDevice, settingsRef.current);
        },
      });
      phoneReceiverRef.current = receiver;
      receiver.start();
    } catch (err) {
      setBridgeStatus('error');
      setBridgeStatusText(
        err instanceof Error ? err.message : 'Не вдалося створити сесію сполучення.'
      );
    }
  }, [startDeviceStream]);

  // Auto-create DropCam pairing code on desktop launch so QR is ready immediately
  useEffect(() => {
    if (phoneModeCode === null) {
      void handleCreatePairingSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time canvas processing loop + accurate FPS measurement
  useEffect(() => {
    if (!isStreaming) return;

    let cancelled = false;
    let rafId = 0;
    let frameCounter = 0;
    let totalFrames = 0;
    let lastMeasureTime = performance.now();
    let lastFrameTime = performance.now();

    const processCurrentFrame = (now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        renderProcessedFrame(
          video,
          canvas,
          settingsRef.current,
          capabilitiesRef.current,
          {
            compareSplit: compareSplitRef.current,
            splitRatio: splitRatioRef.current,
            includeOverlayGrid: true,
          }
        );

        frameCounter += 1;
        totalFrames += 1;
        const elapsed = now - lastMeasureTime;

        if (elapsed >= 500) {
          const measuredFps = (frameCounter * 1000) / elapsed;
          const frameTimeMs = now - lastFrameTime;
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          setMetrics((prev) => ({
            ...prev,
            active: true,
            actualWidth: vw,
            actualHeight: vh,
            measuredFps,
            frameTimeMs,
            totalFrames,
            aspectRatio: computeAspectRatio(vw, vh),
          }));

          frameCounter = 0;
          lastMeasureTime = now;
        }
        lastFrameTime = now;
      }
    };

    const videoEl = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: (now: number) => void) => number;
          cancelVideoFrameCallback?: (id: number) => void;
        })
      | null;

    if (videoEl && typeof videoEl.requestVideoFrameCallback === 'function') {
      let vfcId = 0;
      const onVideoFrame = (now: number) => {
        if (cancelled) return;
        processCurrentFrame(now);
        vfcId = videoEl.requestVideoFrameCallback!(onVideoFrame);
      };
      vfcId = videoEl.requestVideoFrameCallback(onVideoFrame);
      return () => {
        cancelled = true;
        videoEl.cancelVideoFrameCallback?.(vfcId);
      };
    }

    const tick = (now: number) => {
      if (cancelled) return;
      processCurrentFrame(now);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [isStreaming]);

  const allDevices = phoneDevice ? [phoneDevice, ...devices] : devices;
  const selectedDevice = allDevices.find((d) => d.id === selectedDeviceId) || null;

  const handleToggleStream = () => {
    if (!selectedDevice) return;
    if (isStreaming) {
      stopActiveStream();
      addLog('info', 'Потік', `Потік камери "${selectedDevice.name}" зупинено.`);
    } else {
      void startDeviceStream(selectedDevice, settings);
    }
  };

  const handleChangeFormat = async (
    width: number,
    height: number,
    frameRate: number
  ) => {
    const nextSettings: CameraSettings = {
      ...settings,
      width,
      height,
      frameRate,
    };
    setSettings(nextSettings);
    setActiveProfileId(null);

    if (!selectedDevice) return;

    if (selectedDevice.id.startsWith('webrtc-phone-')) {
      void phoneReceiverRef.current?.sendRemoteCommand({
        action: 'set-resolution',
        width,
        height,
      });
      setStatusFeedback(
        `Надіслано запит зміни роздільної здатності на телефон (${width}×${height}).`
      );
      return;
    }

    const track = trackRef.current;
    if (isStreaming && track) {
      try {
        await track.applyConstraints({
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: frameRate },
        });
        const applied = track.getSettings();
        const actualW = applied.width || width;
        const actualH = applied.height || height;
        const actualFps = Math.round(applied.frameRate || frameRate);

        setMetrics((prev) => ({
          ...prev,
          requestedWidth: width,
          requestedHeight: height,
          targetFps: frameRate,
          actualWidth: actualW,
          actualHeight: actualH,
          aspectRatio: computeAspectRatio(actualW, actualH),
        }));
        setStatusFeedback(
          `Формат застосовано без перезапуску: ${actualW}×${actualH} @ ${actualFps} FPS`
        );
        addLog(
          'success',
          'Формат',
          `Застосовано наживо: ${actualW}×${actualH} @ ${actualFps} FPS.`
        );
        return;
      } catch {
        // Some drivers require reopening stream for resolution switch
      }
    }

    await startDeviceStream(selectedDevice, nextSettings);
  };

  const handleChangeControl = (key: CameraControlKey, value: number) => {
    const updated: CameraSettings = {
      ...settings,
      [key]: value,
      ...(key === 'exposure' ? { autoExposure: false } : {}),
      ...(key === 'whiteBalance' ? { autoWhiteBalance: false } : {}),
      ...(key === 'focus' ? { autoFocus: false } : {}),
    };
    setSettings(updated);
    setActiveProfileId(null);

    const existingTimer = controlTimersRef.current[key];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    controlTimersRef.current[key] = window.setTimeout(async () => {
      const res = await applyHardwareControl(
        trackRef.current,
        key,
        value,
        capabilitiesRef.current,
        updated
      );
      setStatusFeedback(res.detail);
    }, 60);
  };

  const handleToggleAutoMode = async (
    modeKey: 'autoFocus' | 'autoExposure' | 'autoWhiteBalance',
    value: boolean
  ) => {
    const updated = { ...settings, [modeKey]: value };
    setSettings(updated);
    const controlKey: CameraControlKey =
      modeKey === 'autoFocus'
        ? 'focus'
        : modeKey === 'autoExposure'
        ? 'exposure'
        : 'whiteBalance';
    const res = await applyHardwareControl(
      trackRef.current,
      controlKey,
      updated[controlKey],
      capabilities,
      updated
    );
    setStatusFeedback(res.detail);
  };

  const handleResetControl = (key: CameraControlKey) => {
    const defVal = DEFAULT_CAMERA_SETTINGS[key];
    handleChangeControl(key, defVal);
  };

  const handleResetAll = async () => {
    const resetSettings: CameraSettings = {
      ...DEFAULT_CAMERA_SETTINGS,
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
    };
    setSettings(resetSettings);
    setActiveProfileId(null);
    if (selectedDevice?.id.startsWith('webrtc-phone-') && settings.torch) {
      void phoneReceiverRef.current?.sendRemoteCommand({
        action: 'set-torch',
        enabled: false,
      });
    }
    if (trackRef.current && !selectedDevice?.id.startsWith('webrtc-phone-')) {
      await applyAllHardwareControlsForTrack(
        trackRef.current,
        capabilities,
        resetSettings
      );
    }
    setStatusFeedback('Усі параметри зображення скинуто до стандартних значень.');
  };

  const handleSaveProfile = (name: string) => {
    if (!selectedDevice) return;
    const record = createProfileRecord(name, selectedDevice, settings);
    const next = [record, ...profiles];
    setProfiles(next);
    saveProfiles(next);
    setActiveProfileId(record.id);
    setStatusFeedback(`Профіль «${record.name}» збережено.`);
    addLog('success', 'Профіль', `Збережено профіль "${record.name}" для ${selectedDevice.name}.`);
  };

  const handleApplyProfile = (profile: CameraProfile) => {
    const targetDevice =
      allDevices.find(
        (d) =>
          d.name.toLowerCase() === profile.cameraName.toLowerCase() ||
          d.id === selectedDeviceId
      ) || selectedDevice;

    const merged: CameraSettings = {
      ...DEFAULT_CAMERA_SETTINGS,
      ...profile.settings,
    };
    setSettings(merged);
    setActiveProfileId(profile.id);
    setActiveTab('studio');

    if (targetDevice) {
      setSelectedDeviceId(targetDevice.id);
      setLastSelectedCameraId(targetDevice.id);
      void startDeviceStream(targetDevice, merged);
    }
    setStatusFeedback(`Застосовано профіль «${profile.name}».`);
  };

  const handleDeleteProfile = (profileId: string) => {
    const next = profiles.filter((p) => p.id !== profileId);
    setProfiles(next);
    saveProfiles(next);
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
    }
  };

  const handleRenameProfile = (profileId: string, newName: string) => {
    const next = profiles.map((p) =>
      p.id === profileId
        ? { ...p, name: newName, updatedAt: new Date().toISOString() }
        : p
    );
    setProfiles(next);
    saveProfiles(next);
  };

  const handleImportProfiles = (imported: CameraProfile[]) => {
    const existingIds = new Set(profiles.map((p) => p.id));
    const merged = [
      ...imported.map((item) =>
        existingIds.has(item.id)
          ? { ...item, id: `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }
          : item
      ),
      ...profiles,
    ];
    setProfiles(merged);
    saveProfiles(merged);
    addLog('success', 'Імпорт', `Імпортовано профілів: ${imported.length}.`);
  };

  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !selectedDevice) return;
    const shot = captureCleanSnapshot(video, settings, capabilities);
    if (!shot) {
      setStatusFeedback('Зачекайте на перший кадр перед створенням фотознімка.');
      return;
    }

    const item: SnapshotItem = {
      id: `snap_${Date.now()}`,
      cameraName: selectedDevice.name,
      timestamp: new Date().toLocaleTimeString('uk-UA'),
      width: shot.width,
      height: shot.height,
      dataUrl: shot.dataUrl,
    };

    setSnapshots((prev) => [item, ...prev.slice(0, 7)]);
    setStatusFeedback(`Фотознімок (${shot.width}×${shot.height}) додано нижче під відео.`);
    addLog(
      'success',
      'Знімок',
      `Зроблено фотознімок (${shot.width}×${shot.height}) з камери "${selectedDevice.name}".`
    );
  };

  const handleDownloadSnapshot = (snap: SnapshotItem) => {
    const a = document.createElement('a');
    a.href = snap.dataUrl;
    a.download = `camcontrol-${snap.cameraName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    a.click();
  };

  const handleRemoveSnapshot = (id: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRunDiagnosticCheck = async () => {
    addLog('info', 'Перевірка', 'Запущено перевірку підключених пристроїв та параметрів потоку…');
    await refreshDeviceList(false);
    if (trackRef.current) {
      const caps = inspectTrackCapabilities(trackRef.current);
      setCapabilities(caps);
      const hwCount = Object.values(caps.controls).filter(
        (c) => c.mode === 'hardware'
      ).length;
      addLog(
        'success',
        'Перевірка',
        `Потік активний (${metrics.actualWidth}×${metrics.actualHeight} @ ${metrics.measuredFps.toFixed(1)} FPS). Апаратних регуляторів: ${hwCount}.`
      );
    } else {
      addLog(
        'warning',
        'Перевірка',
        'Активний відеопотік відсутній; перевірено лише список камер.'
      );
    }
  };

  if (phoneModeCode !== null) {
    return (
      <PhoneTransmitterView
        initialCode={phoneModeCode}
        onExitPhoneMode={() => {
          setPhoneModeCode(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('phone');
          window.history.replaceState({}, '', url.toString());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#0C111A] text-[#E8EDF5] overflow-x-hidden">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefreshCameras={() => void refreshDeviceList(true)}
        isScanning={isScanning}
      />

      {activeTab === 'studio' && (
        <main className="flex-1 flex flex-col lg:flex-row min-h-0">
          <CameraSidebar
            devices={allDevices}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={(dev) => handleSelectDevice(dev, true)}
            isScanning={isScanning}
            permissionGranted={permissionGranted}
            onRequestPermission={() => void refreshDeviceList(true)}
            discoveryWarning={discoveryWarning}
            profiles={profiles}
            activeProfileId={activeProfileId}
            onApplyProfile={handleApplyProfile}
            onOpenPhoneModal={(tab) => {
              setPhoneModalTab(tab);
              setIsPhoneModalOpen(true);
            }}
            pairingCode={pairingCode}
            bridgeStatus={bridgeStatus}
            onOpenPhoneModeHere={() => setPhoneModeCode('')}
          />

          <LivePreviewStage
            selectedDevice={selectedDevice}
            videoRef={videoRef}
            canvasRef={canvasRef}
            isStreaming={isStreaming}
            isStarting={isStarting}
            streamError={streamError}
            metrics={metrics}
            settings={settings}
            compareSplit={compareSplit}
            splitRatio={splitRatio}
            onToggleStream={handleToggleStream}
            onTakeSnapshot={handleTakeSnapshot}
            onToggleMirror={() =>
              setSettings((prev) => ({ ...prev, mirror: !prev.mirror }))
            }
            onToggleGrid={() =>
              setSettings((prev) => ({ ...prev, showGrid: !prev.showGrid }))
            }
            onRotate90={() =>
              setSettings((prev) => ({
                ...prev,
                rotation: ((prev.rotation + 90) % 360) as 0 | 90 | 180 | 270,
              }))
            }
            onToggleCompare={() => setCompareSplit((prev) => !prev)}
            onSplitRatioChange={setSplitRatio}
            onRemoteFlipPhone={() => {
              void phoneReceiverRef.current?.sendRemoteCommand({
                action: 'flip-camera',
              });
              setStatusFeedback('Команду перемикання камери надіслано на телефон.');
            }}
            onRemoteToggleTorch={() => {
              const nextTorch = !settings.torch;
              setSettings((prev) => ({ ...prev, torch: nextTorch }));
              void phoneReceiverRef.current?.sendRemoteCommand({
                action: 'set-torch',
                enabled: nextTorch,
              });
            }}
            onRemoteToggleMic={() => {
              const nextMic = !settings.micEnabled;
              setSettings((prev) => ({ ...prev, micEnabled: nextMic }));
              void phoneReceiverRef.current?.sendRemoteCommand({
                action: 'set-mic',
                enabled: nextMic,
              });
            }}
            snapshots={snapshots}
            onDownloadSnapshot={handleDownloadSnapshot}
            onRemoveSnapshot={handleRemoveSnapshot}
            pairingCode={pairingCode}
            bridgeStatus={bridgeStatus}
            bridgeStatusText={bridgeStatusText}
            onRefreshPairingCode={() => void handleCreatePairingSession()}
            onOpenPhoneModeHere={() => setPhoneModeCode('')}
            onOpenUsbHelp={() => {
              setPhoneModalTab('usb');
              setIsPhoneModalOpen(true);
            }}
            onClearStreamError={() => setStreamError(null)}
          />

          <InspectorPanel
            selectedDevice={selectedDevice}
            capabilities={capabilities}
            settings={settings}
            isStreaming={isStreaming}
            onChangeFormat={(w, h, fps) => void handleChangeFormat(w, h, fps)}
            onChangeControl={handleChangeControl}
            onToggleAutoMode={(field, val) => void handleToggleAutoMode(field, val)}
            onResetControl={handleResetControl}
            onResetAll={() => void handleResetAll()}
            onSaveProfile={handleSaveProfile}
            statusFeedback={statusFeedback}
          />
        </main>
      )}

      {activeTab === 'diagnostics' && (
        <DiagnosticsView
          runtimeInfo={runtimeInfo}
          devices={allDevices}
          selectedDevice={selectedDevice}
          capabilities={capabilities}
          settings={settings}
          metrics={metrics}
          logs={logs}
          onRunDiagnosticCheck={() => void handleRunDiagnosticCheck()}
        />
      )}

      {activeTab === 'profiles' && (
        <ProfilesView
          profiles={profiles}
          devices={allDevices}
          activeProfileId={activeProfileId}
          onApplyProfile={handleApplyProfile}
          onDeleteProfile={handleDeleteProfile}
          onRenameProfile={handleRenameProfile}
          onImportProfiles={handleImportProfiles}
        />
      )}

      {activeTab === 'windows-build' && (
        <WindowsBuildView runtimeInfo={runtimeInfo} />
      )}

      <PhoneConnectModal
        isOpen={isPhoneModalOpen}
        initialTab={phoneModalTab}
        onClose={() => setIsPhoneModalOpen(false)}
        pairingCode={pairingCode}
        bridgeStatus={bridgeStatus}
        bridgeStatusText={bridgeStatusText}
        onCreatePairingSession={() => void handleCreatePairingSession()}
        onRefreshUsbDevices={() => void refreshDeviceList(true)}
        isScanning={isScanning}
        onOpenPhoneModeHere={() => {
          setIsPhoneModalOpen(false);
          setPhoneModeCode('');
        }}
      />
    </div>
  );
}
