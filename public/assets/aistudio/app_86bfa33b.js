const invoke = window.__TAURI__?.core?.invoke;
const platform = document.querySelector('#platform');
const state = document.querySelector('#system-state');
const output = document.querySelector('#diagnostic-output');
const deviceList = document.querySelector('#device-list');
const deviceCount = document.querySelector('#device-count');
const refreshButton = document.querySelector('#refresh');
const diagnoseButton = document.querySelector('#diagnose');
const previewImage = document.querySelector('#preview-image');
const previewPlaceholder = document.querySelector('#preview-placeholder');
const previewStatus = document.querySelector('#preview-status');
const stopPreviewButton = document.querySelector('#stop-preview');
let previewRunning = false;
let previewSession = 0;

function showMessage(message) {
  deviceList.replaceChildren();
  const item = document.createElement('div');
  item.className = 'empty-state';
  item.textContent = message;
  deviceList.append(item);
}

function renderDevices(devices) {
  deviceCount.textContent = String(devices.length);
  deviceList.replaceChildren();
  if (devices.length === 0) {
    showMessage('Камер не знайдено. Перевірте підключення та дозволи операційної системи.');
    return;
  }
  for (const device of devices) {
    const card = document.createElement('article');
    card.className = 'device-card';
    const heading = document.createElement('strong');
    heading.textContent = device.name || 'Невідома камера';
    const details = document.createElement('p');
    details.textContent = `${device.description || 'Без опису'} · ID: ${device.id}`;
    const meta = document.createElement('small');
    meta.textContent = `Backend: ${device.backend} · Статус: виявлено`;
    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'preview-device-button';
    previewButton.textContent = 'Перегляд';
    previewButton.addEventListener('click', () => startPreview(device.id, device.name));
    card.append(heading, details, meta, previewButton);
    deviceList.append(card);
  }
}

async function loadInfo() {
  if (!invoke) {
    state.textContent = 'Попередній перегляд';
    platform.textContent = 'Для доступу до камер запустіть Tauri-застосунок.';
    showMessage('Відкрито статичний перегляд інтерфейсу.');
    return;
  }
  try {
    const info = await invoke('app_info');
    state.textContent = 'Backend активний';
    platform.textContent = `${info.platform} · ${info.architecture} · версія ${info.version}`;
    await refreshCameras();
  } catch (error) {
    state.textContent = 'Помилка backend';
    platform.textContent = String(error);
  }
}

async function refreshCameras() {
  if (!invoke) return;
  refreshButton.disabled = true;
  refreshButton.textContent = 'Сканування…';
  try {
    const devices = await invoke('list_cameras');
    renderDevices(devices);
  } catch (error) {
    deviceCount.textContent = '—';
    showMessage(`Не вдалося отримати список камер: ${String(error)}`);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Оновити';
  }
}

refreshButton.addEventListener('click', refreshCameras);

async function stopPreview() {
  previewSession += 1;
  previewRunning = false;
  if (invoke) {
    try { await invoke('stop_preview'); } catch (error) { previewStatus.textContent = `Зупинка: ${String(error)}`; }
  }
  stopPreviewButton.disabled = true;
  previewImage.removeAttribute('src');
  previewImage.hidden = true;
  previewPlaceholder.hidden = false;
}

async function startPreview(cameraId, cameraName) {
  if (!invoke) {
    previewStatus.textContent = 'Відеоперегляд доступний лише у Tauri-застосунку.';
    return;
  }
  await stopPreview();
  const session = ++previewSession;
  previewRunning = true;
  previewStatus.textContent = `Відкриття камери: ${cameraName || cameraId}…`;
  try {
    await invoke('start_preview', { cameraId: String(cameraId) });
    if (session !== previewSession) {
      await invoke('stop_preview').catch(() => {});
      return;
    }
    stopPreviewButton.disabled = false;
    previewPlaceholder.hidden = true;
    previewImage.hidden = false;
    previewStatus.textContent = `Відеопотік активний: ${cameraName || cameraId}`;
    while (previewRunning && session === previewSession) {
      try {
        const frame = await invoke('capture_preview_frame');
        if (!previewRunning || session !== previewSession) break;
        previewImage.src = frame.dataUrl;
        previewImage.alt = `Кадр ${frame.width} × ${frame.height}`;
        previewStatus.textContent = `${cameraName || cameraId} · ${frame.width} × ${frame.height}`;
      } catch (error) {
        if (session !== previewSession) break;
        previewStatus.textContent = `Помилка кадру: ${String(error)}`;
        previewRunning = false;
        try { await invoke('stop_preview'); } catch { /* camera may already be disconnected */ }
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    if (session !== previewSession) return;
    previewRunning = false;
    previewStatus.textContent = `Не вдалося запустити камеру: ${String(error)}`;
    previewPlaceholder.hidden = false;
    previewImage.hidden = true;
  } finally {
    if (session === previewSession) stopPreviewButton.disabled = true;
  }
}

stopPreviewButton.addEventListener('click', stopPreview);
window.addEventListener('beforeunload', () => {
  if (invoke) void invoke('stop_preview').catch(() => {});
});


diagnoseButton.addEventListener('click', async () => {
  if (!invoke) {
    output.textContent = 'Діагностика доступна лише в запущеному Tauri-застосунку.';
    return;
  }
  diagnoseButton.disabled = true;
  try {
    const report = await invoke('run_basic_diagnostics');
    output.textContent = JSON.stringify(report, null, 2);
  } catch (error) {
    output.textContent = `Помилка діагностики: ${String(error)}`;
  } finally {
    diagnoseButton.disabled = false;
  }
});

loadInfo();
