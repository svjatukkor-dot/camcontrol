# Roadmap

## Phase 0 — Foundation
- [x] Define cross-platform scope and capability-first design.
- [x] Establish Rust workspace and Tauri 2 desktop shell.
- [x] Add honest application and diagnostic status reporting.
- [x] Integrate `nokhwa` native camera discovery backend.
- [x] Add UI flow for listing devices returned by the native backend.
- [ ] Validate compilation and tests on Windows, Linux and macOS CI.

## Phase 1 — Local camera discovery (in progress)
- [x] Use native OS capture backends through `nokhwa` (`Media Foundation`, `AVFoundation`, `Video4Linux`).
- [ ] Verify stable identifiers and device metadata on all three OSes.
- [ ] Add hardware test runs for USB webcams and UVC capture cards.
- [ ] Query supported formats and frame rates.

## Phase 2 — Preview and diagnostics
- [x] Open/close capture streams and render an initial live preview.
- [ ] Measure delivered FPS, frame dimensions, latency and dropped frames.
- [ ] Export diagnostic reports as JSON and human-readable text.
- [ ] Distinguish permission, busy-device, driver and unsupported-operation errors.

## Phase 3 — Camera controls
- [ ] Query device-supported controls before showing them in the UI.
- [ ] Implement supported focus, exposure, white balance and image controls.
- [ ] Read back values after writes; never claim a setting was applied without confirmation.

## Phase 4 — Network cameras
- [ ] ONVIF discovery and capability inspection.
- [ ] RTSP preview, authentication and reconnect handling.
- [ ] Secure credential storage.

## Phase 5 — Mobile companion applications
- [ ] Android companion: Wi-Fi pairing, capability API and video transport.
- [ ] Android USB/ADB-assisted setup where technically appropriate.
- [ ] iOS companion: local-network pairing and supported capture controls.
- [ ] Evaluate iPhone USB support; do not assume generic USB control is available.

## Phase 6 — Release readiness
- [x] Add cross-platform CI checks and automated Windows installer workflow.
- [ ] Verify successful CI and Windows installer artifacts in a real GitHub repository.
- [ ] Installers, signing/notarization guidance and release artifacts.
- [ ] Security review of pairing and stream transport.
- [ ] Complete user documentation, troubleshooting guide and license selection.
