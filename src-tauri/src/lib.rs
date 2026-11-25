use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::codecs::jpeg::JpegEncoder;
use image::ColorType;
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{
    ApiBackend, CameraIndex, ControlValueSetter, KnownCameraControl, RequestedFormat,
    RequestedFormatType,
};
use nokhwa::Camera;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
struct PreviewState {
    camera: Mutex<Option<Camera>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
    pub architecture: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraDeviceDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub backend: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewFrameDto {
    pub width: u32,
    pub height: u32,
    pub data_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticReport {
    pub app: AppInfo,
    pub camera_backend_query: String,
    pub discovered_count: usize,
    pub devices: Vec<CameraDeviceDto>,
}

fn current_app_info() -> AppInfo {
    AppInfo {
        name: "CamControl".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        architecture: std::env::consts::ARCH.to_string(),
    }
}

fn parse_camera_index(camera_id: &str) -> Result<CameraIndex, String> {
    if let Ok(num) = camera_id.parse::<u32>() {
        Ok(CameraIndex::Index(num))
    } else {
        Ok(CameraIndex::String(camera_id.to_string()))
    }
}

fn map_control_name(control: &str) -> Option<KnownCameraControl> {
    match control {
        "brightness" => Some(KnownCameraControl::Brightness),
        "contrast" => Some(KnownCameraControl::Contrast),
        "saturation" => Some(KnownCameraControl::Saturation),
        "sharpness" => Some(KnownCameraControl::Sharpness),
        "exposure" => Some(KnownCameraControl::Exposure),
        "whiteBalance" => Some(KnownCameraControl::WhiteBalance),
        "zoom" => Some(KnownCameraControl::Zoom),
        "focus" => Some(KnownCameraControl::Focus),
        _ => None,
    }
}

#[tauri::command]
fn app_info() -> AppInfo {
    current_app_info()
}

#[tauri::command]
fn list_cameras() -> Result<Vec<CameraDeviceDto>, String> {
    let devices = nokhwa::query(ApiBackend::Auto).map_err(|e| format!("Помилка запиту камер: {e}"))?;
    let backend_label = match std::env::consts::OS {
        "windows" => "Media Foundation",
        "macos" => "AVFoundation",
        "linux" => "Video4Linux2",
        other => other,
    };

    Ok(devices
        .into_iter()
        .map(|info| CameraDeviceDto {
            id: info.index().to_string(),
            name: info.human_name(),
            description: info.description().to_string(),
            backend: backend_label.to_string(),
        })
        .collect())
}

#[tauri::command]
fn start_preview(camera_id: String, state: State<'_, PreviewState>) -> Result<(), String> {
    let mut guard = state
        .camera
        .lock()
        .map_err(|_| "Не вдалося отримати блокування стану камери".to_string())?;

    if let Some(mut existing) = guard.take() {
        let _ = existing.stop_stream();
    }

    let index = parse_camera_index(&camera_id)?;
    let requested =
        RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    let mut cam =
        Camera::new(index, requested).map_err(|e| format!("Не вдалося відкрити камеру: {e}"))?;
    cam.open_stream()
        .map_err(|e| format!("Не вдалося запустити відеопотік: {e}"))?;

    *guard = Some(cam);
    Ok(())
}

#[tauri::command]
fn capture_preview_frame(state: State<'_, PreviewState>) -> Result<PreviewFrameDto, String> {
    let mut guard = state
        .camera
        .lock()
        .map_err(|_| "Помилка доступу до потоку камери".to_string())?;

    let cam = guard
        .as_mut()
        .ok_or_else(|| "Відеопотік не запущено".to_string())?;

    let frame = cam
        .frame()
        .map_err(|e| format!("Помилка читання кадру: {e}"))?;
    let decoded = frame
        .decode_image::<RgbFormat>()
        .map_err(|e| format!("Помилка декодування кадру: {e}"))?;

    let width = decoded.width();
    let height = decoded.height();
    let mut jpeg_buf = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut jpeg_buf, 85);
    encoder
        .encode(decoded.as_raw(), width, height, ColorType::Rgb8.into())
        .map_err(|e| format!("Помилка кодування JPEG: {e}"))?;

    Ok(PreviewFrameDto {
        width,
        height,
        data_url: format!("data:image/jpeg;base64,{}", BASE64.encode(&jpeg_buf)),
    })
}

#[tauri::command]
fn stop_preview(state: State<'_, PreviewState>) -> Result<(), String> {
    let mut guard = state
        .camera
        .lock()
        .map_err(|_| "Помилка блокування стану камери".to_string())?;
    if let Some(mut cam) = guard.take() {
        let _ = cam.stop_stream();
    }
    Ok(())
}

#[tauri::command]
fn set_camera_control(
    control: String,
    value: f64,
    state: State<'_, PreviewState>,
) -> Result<(), String> {
    let known = map_control_name(&control)
        .ok_or_else(|| format!("Невідомий параметр керування: {control}"))?;

    let mut guard = state
        .camera
        .lock()
        .map_err(|_| "Помилка доступу до стану камери".to_string())?;

    let cam = guard
        .as_mut()
        .ok_or_else(|| "Спочатку запустіть перегляд камери".to_string())?;

    cam.set_camera_control(known, ControlValueSetter::Integer(value.round() as i64))
        .map_err(|e| format!("Драйвер не прийняв зміну параметра {control}: {e}"))?;

    Ok(())
}

#[tauri::command]
fn run_basic_diagnostics() -> DiagnosticReport {
    let app = current_app_info();
    match list_cameras() {
        Ok(devices) => DiagnosticReport {
            app,
            camera_backend_query: "ok".to_string(),
            discovered_count: devices.len(),
            devices,
        },
        Err(err) => DiagnosticReport {
            app,
            camera_backend_query: format!("error: {err}"),
            discovered_count: 0,
            devices: Vec::new(),
        },
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbPhoneDto {
    pub serial: String,
    pub model: String,
    pub state: String,
}

fn parse_adb_devices_output(stdout: &str) -> Vec<UsbPhoneDto> {
    stdout
        .lines()
        .skip(1)
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            let mut parts = trimmed.split_whitespace();
            let serial = parts.next()?.to_string();
            let state = parts.next().unwrap_or("unknown").to_string();
            let model = parts
                .find_map(|token| token.strip_prefix("model:"))
                .map(|m| m.replace('_', " "))
                .unwrap_or_else(|| "Android Пристрій".to_string());
            Some(UsbPhoneDto {
                serial,
                model,
                state,
            })
        })
        .collect()
}

#[tauri::command]
fn list_usb_phones() -> Vec<UsbPhoneDto> {
    match std::process::Command::new("adb").args(["devices", "-l"]).output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            parse_adb_devices_output(&stdout)
        }
        _ => Vec::new(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PreviewState::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            list_cameras,
            list_usb_phones,
            start_preview,
            capture_preview_frame,
            stop_preview,
            set_camera_control,
            run_basic_diagnostics
        ])
        .run(tauri::generate_context!())
        .expect("Помилка запуску CamControl");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_supported_control_keys() {
        assert!(matches!(
            map_control_name("brightness"),
            Some(KnownCameraControl::Brightness)
        ));
        assert!(matches!(
            map_control_name("sharpness"),
            Some(KnownCameraControl::Sharpness)
        ));
        assert!(map_control_name("unknown").is_none());
    }

    #[test]
    fn builds_app_info_metadata() {
        let info = current_app_info();
        assert_eq!(info.name, "CamControl");
        assert!(!info.version.is_empty());
    }

    #[test]
    fn parses_adb_devices_list() {
        let sample = "List of devices attached\nR58M12345AB\tdevice product:beyond1 model:SM_G973F device:beyond1\n";
        let parsed = parse_adb_devices_output(sample);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].serial, "R58M12345AB");
        assert_eq!(parsed[0].model, "SM G973F");
        assert_eq!(parsed[0].state, "device");
    }
}
