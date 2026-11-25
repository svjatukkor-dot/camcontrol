# Збірка CamControl для Windows 10 та Windows 11 (.exe / .msi)

## 1. Системні вимоги для локальної збірки
- **Windows 10 або Windows 11 (x64)**
- **Node.js LTS** (версія 20+)
- **Rust (stable)** через `rustup` з компілятором **Microsoft C++ Build Tools (MSVC)**
- **WebView2 Runtime** (вбудований у Windows 11 і більшість систем Windows 10)
- **Tauri CLI v2**:
  ```powershell
  cargo install tauri-cli --version "^2.0.0" --locked
  ```

## 2. Локальна збірка готового `.exe`
У корені проєкту виконайте:
```powershell
npm install
npm run build
cargo tauri build --bundles msi,nsis
```

Після завершення збірки готові файли будуть створені у каталогах:
- Інсталятор `.exe` (NSIS): `src-tauri/target/release/bundle/nsis/CamControl_1.0.0_x64-setup.exe`
- Інсталятор `.msi`: `src-tauri/target/release/bundle/msi/CamControl_1.0.0_x64_en-US.msi`
- Виконуваний файл без інсталяції: `src-tauri/target/release/camcontrol.exe`

## 3. Автоматична збірка без встановлення Rust (GitHub Actions)
1. Завантажте цей проєкт до власного репозиторію на GitHub.
2. Перейдіть у вкладку **Actions** → **Windows installer** → **Run workflow** (або створіть Git-тег `v1.0.0` і зробіть `git push origin main --tags`).
3. GitHub Actions автоматично збере файли `.exe` та `.msi` на сервері `windows-latest` і прикріпить їх до релізу.
