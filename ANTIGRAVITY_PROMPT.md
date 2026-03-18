# 🤖 Antigravity Handoff Prompt — YT Music Desktop App

Paste this entire prompt into Antigravity to continue development.

---

## Context

We are building **YT Music Desktop** — an Electron app that wraps YouTube Music
(music.youtube.com) in a native desktop window. It uses BrowserView (real Chromium)
so Google login works exactly like Chrome, no API key needed.

The codebase is in this folder structure:

```
ytmusic-desktop/
├── main.js                        ← Electron main process
├── preload.js                     ← IPC bridge for title bar only
├── renderer/index.html            ← Custom 44px title bar UI
├── assets/
│   ├── icon.ico                   ← Windows taskbar icon (ADD THIS)
│   ├── icon.icns                  ← macOS dock icon (ADD THIS)
│   ├── icon.png                   ← Linux / fallback icon (ADD THIS)
│   └── tray-icon.png              ← System tray icon 16x16 (ADD THIS)
├── build/
│   ├── entitlements.mac.plist     ← macOS code-signing entitlements
│   └── installer.nsh              ← Windows NSIS protocol registration
├── .github/workflows/build.yml   ← GitHub Actions CI for auto-publishing
├── package.json
└── README.md
```

---

## Changes already implemented in this version (v3)

### 1. MAXIMIZED on launch (main.js lines ~90–130)
- `settings.maximized = true` as default
- `mainWindow.maximize()` called in `ready-to-show`
- `screen.getPrimaryDisplay().workAreaSize` used for fallback size
- Maximized state is saved/restored between sessions

### 2. WINDOW CONTROLS — proper platform behaviour (renderer/index.html)

**Windows** (top-right, Spotify/Chrome style):
- Three buttons: `─` minimize, `□` maximize/restore, `✕` close
- CSS: `.wc-btn` — 46px wide, full titlebar height, no border-radius
- Close button turns red on hover (`#e81123`)
- Max icon swaps to restore icon when maximized (handled by `api.on('maximized')`)
- IDs: `#wc-min`, `#wc-max`, `#wc-close`

**macOS** (top-left, native traffic lights):
- `frame: false` + `titleBarStyle: 'hiddenInset'` in BrowserWindow options (main.js ~line 195)
- `trafficLightPosition: { x: 14, y: 13 }` positions them in our custom bar
- CSS `.platform-darwin #win-controls { display: none }` hides Windows buttons
- CSS `.platform-darwin #mac-spacer { display: block }` shows 76px spacer for traffic lights
- No custom HTML buttons on macOS — native traffic lights handle everything

### 3. APP ICON in taskbar/dock (main.js ~lines 95–140)
- `getAppIcon()` function checks `assets/icon.ico` (win), `assets/icon.icns` (mac), `assets/icon.png` (linux)
- `buildFallbackIcon()` generates a red programmatic icon if no asset file found
- `icon: appIcon` set in BrowserWindow options
- `mainWindow.setIcon(appIcon)` called explicitly for Windows taskbar

### 4. OS SEARCH / SPOTLIGHT support
- Windows: NSIS installer (`build/installer.nsh`) writes app to `App Paths` registry key
  → app appears in Start menu search after install
- macOS: Dragging .app to /Applications automatically makes it appear in Spotlight
- `ytmusic://` deep-link protocol registered via:
  - `app.setAsDefaultProtocolClient('ytmusic')` in main.js (top of file)
  - `protocols` array in package.json build config
  - NSIS installer writes HKCU registry keys for Windows

### 5. GITHUB ACTIONS auto-publish (.github/workflows/build.yml)
- Triggers on `git tag v*` push
- Builds Windows, macOS, Linux simultaneously on separate runners
- Uploads all installers to GitHub Releases automatically
- Requires `GH_TOKEN` secret in GitHub repo settings

---

## TODO for Antigravity to complete

### A. Add real icon files
```
Task: Add the YouTube Music logo as icon assets

1. Download or create a 512×512 PNG of the YouTube Music logo
   (red background, white circle, music note / play triangle)

2. Convert to:
   - assets/icon.ico  (256×256, Windows)
     Tool: https://icoconvert.com
   - assets/icon.icns (512×512, macOS)
     Tool: https://convertio.co/png-icns/
   - assets/icon.png  (512×512, Linux + fallback)
   - assets/tray-icon.png (32×32, white on transparent for macOS menu bar)

3. Place all files in the assets/ folder
```

### B. Publish to GitHub
```
Task: Set up GitHub repo and publish first release

1. Create repo at github.com/new
   Name: ytmusic-desktop
   Visibility: Public

2. Update package.json — replace YOUR_GITHUB_USERNAME:
   Line: "owner": "YOUR_GITHUB_USERNAME"

3. Update README.md — replace YOUR_USERNAME in all links

4. Push code:
   git init
   git add .
   git commit -m "feat: initial release v1.0.0"
   git remote add origin https://github.com/YOUR_USERNAME/ytmusic-desktop.git
   git push -u origin main

5. Create GitHub token:
   GitHub Settings → Developer Settings → Personal Access Tokens (Fine-grained)
   Permissions: Contents (read/write), Actions (read)

6. Add token to repo secrets:
   Repo → Settings → Secrets and Variables → Actions
   New secret: name = GH_TOKEN, value = <your token>

7. Tag and push to trigger build:
   git tag v1.0.0
   git push origin v1.0.0

8. Watch build at: https://github.com/YOUR_USERNAME/ytmusic-desktop/actions
   Download link will be: https://github.com/YOUR_USERNAME/ytmusic-desktop/releases/latest
```

### C. Optional — create a download landing page
```
Task: Create a simple index.html landing page (can be hosted on GitHub Pages)

Content:
- App name + logo
- Download buttons for Windows / macOS / Linux (link to GitHub Releases)
- Brief feature list
- Screenshot or mockup

Enable GitHub Pages:
Repo → Settings → Pages → Source: Deploy from branch → main → /docs
Save landing page as docs/index.html
```

---

## Key code references for debugging

| Feature | File | Line approx |
|---------|------|------------|
| Maximize on launch | main.js | ~198–205 |
| Window icon | main.js | ~95–140 (getAppIcon, buildFallbackIcon) |
| macOS traffic lights | main.js | ~193–196 (titleBarStyle, trafficLightPosition) |
| Windows controls HTML | renderer/index.html | #win-controls div |
| macOS platform hide | renderer/index.html | `.platform-darwin #win-controls { display:none }` |
| macOS spacer | renderer/index.html | `#mac-spacer` |
| Max icon swap | renderer/index.html | `api.on('maximized', ...)` in script |
| Protocol registration | main.js | top of file, `app.setAsDefaultProtocolClient` |
| NSIS registry | build/installer.nsh | `!macro customInstall` |
| GitHub Actions | .github/workflows/build.yml | full file |
| Session (login persist) | main.js | `getMusicSession()` — `persist:ytmusic` partition |
| UA spoof | main.js | `spoofUA()` function |

---

## Run locally to test
```bash
npm install
npm start
```

## Build installers
```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:all    # all platforms
```
