# Gemini Windows App

A simple, lightweight Windows desktop application for Google Gemini AI.

Built with [Tauri v2](https://tauri.app/) — uses the system's native WebView2 instead of bundling Chromium, resulting in a **~1.7 MB installer** (vs ~75 MB for Electron-based alternatives).

Download: [Releases](https://github.com/nwn900/GeminiWindowsApp/releases/)

## Description
This application provides a convenient way to access Google Gemini AI directly from your desktop, without the need to open a web browser.

## Features
- Direct access to Google Gemini AI
- Native Windows application using WebView2
- Minimalist interface
- System tray with minimize-to-tray support
- Optional launch at Windows startup from the tray menu
- Ultra-lightweight (~1.7 MB installer)

## Installation
1. Download the latest release from the [Releases](https://github.com/nwn900/GeminiWindowsApp/releases/) page.
2. Run the installer (.exe file).
3. Follow the on-screen instructions to complete the installation.

## Usage
1. Launch the Gemini app from your desktop or start menu.
2. The app will open directly to Gemini AI's interface.
3. Start chatting with Gemini!
4. To have Gemini launch with Windows, right-click the tray icon and enable `Launch at system startup`.

## Building from Source

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (1.70+)
- [Tauri CLI](https://tauri.app/): `cargo install tauri-cli --version "^2.0.0" --locked`
- WebView2 (pre-installed on Windows 10/11)

### Build
```bash
git clone https://github.com/nwn900/GeminiWindowsApp.git
cd GeminiWindowsApp/src-tauri
cargo tauri build
```

The installer will be created at `src-tauri/target/release/bundle/nsis/Gemini_<version>_x64-setup.exe`.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the ISC License.

## Acknowledgments
- [Tauri](https://tauri.app/)
- [Google Gemini AI](https://gemini.google.com/)
