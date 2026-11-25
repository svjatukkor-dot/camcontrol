# Testing strategy

## Automated checks

Run from the repository root:

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace
```

The GitHub Actions workflow runs `cargo check` and `cargo test` on Ubuntu, Windows and macOS. A green CI run confirms compilation/tests on hosted runners; it does not replace physical-device testing.

## Hardware matrix

| Platform | Device class | Required checks |
|---|---|---|
| Windows 10/11 | USB UVC webcam | Enumeration, permissions, preview, controls, unplug/replug |
| Linux | USB UVC webcam | Enumeration, `/dev/video*` permissions, preview, controls |
| macOS | USB UVC webcam | Enumeration, camera privacy permission, preview, controls |
| All | HDMI capture card exposing UVC | Enumeration, formats, stable stream |
| All | Android companion | Pairing, capabilities, stream latency, reconnect |
| All | iOS companion | Pairing, privacy permission, capabilities, reconnect |
| All | ONVIF/RTSP camera | Discovery, authentication, stream stability, reconnect |

## Current discovery and preview acceptance criteria

- A device is listed only if the native backend returns it.
- Discovery errors are surfaced to the user rather than converted to an empty success result.
- Diagnostics distinguish discovery from stream validation.
- A detected camera is not described as healthy until a stream has been opened and frames validated.
- Unsupported controls are not presented as working controls.

## Manual device test

1. Connect one known-working USB webcam.
2. Grant the application camera permission in the OS privacy settings.
3. Click **Оновити** and record the displayed device name and ID.
4. Run diagnostics and verify `camera_backend_query` passes.
5. Disconnect the webcam and refresh again.
6. Start preview, confirm moving frames and dimensions, then stop it.
7. Repeat on all three desktop operating systems and with each capture card model.

No physical hardware test is claimed by this repository until test evidence is recorded.


## Live preview checks

- [ ] Start preview from each detected numeric local camera index.
- [ ] Confirm the image updates continuously and reports frame dimensions.
- [ ] Confirm a second camera can replace the active stream.
- [ ] Stop preview and confirm the device is released for another application.
- [ ] Unplug the camera during preview and confirm the UI reports an error without terminating the app.
- [ ] Repeat on Windows (MSMF), Linux (V4L2) and macOS (AVFoundation).

The preview currently transfers JPEG data URLs through Tauri commands at a nominal 10-frame polling interval (100 ms). Actual frame rate depends on camera, backend, resolution and host performance; it is not guaranteed to be 10 FPS.
