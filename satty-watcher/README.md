## Satty Watcher

A lightweight Go-based utility for Fedora (and other Linux distros) that monitors your screenshot directory and automatically opens new captures in **Satty** for instant annotation. It features a JSON-based cache and a timestamp-based cleanup routine to prevent feedback loops when overwriting files.

---

### 📂 File Structure

For a clean installation, the project is organized within its own subdirectory:

* **Location:** `~/.local/bin/satty-watcher/`
* **Binary:** `satty-watcher`
* **Config:** `.env`
* **Cache:** `satty_cache.json` (auto-generated)

---

### 🛠 Installation

#### 1. Prerequisites

Ensure you have `inotify-tools` installed (required for the file system events):

```bash
sudo dnf install inotify-tools

```

#### 2. Setup Directory

```bash
mkdir -p ~/.local/bin/satty-watcher

```

#### 3. Configuration (`.env`)

Create a `.env` file inside `~/.local/bin/satty-watcher/` with the following content:

```ini
WATCH_DIR="/home/yourusername/Pictures/Screenshots"
SATTY_PATH="/home/yourusername/.local/bin/satty/satty"
CACHE_FILE="/home/yourusername/.local/bin/satty-watcher/satty_cache.json"
FILE_EXT=".png"

```

> **Note:** Replace `yourusername` with your actual Linux username.

#### 4. Compile and Move

From your Go project folder:

```bash
go build -o satty-watcher main.go
mv satty-watcher ~/.local/bin/satty-watcher/
chmod +x ~/.local/bin/satty-watcher/satty-watcher

```

---

### 🚀 Running as a Background Service

To ensure the watcher starts automatically when you log in, use a systemd user service.

1. **Create the service file:**
`nano ~/.config/systemd/user/satty-watcher.service`
2. **Paste the configuration:**
```ini
[Unit]
Description=Go Satty Watcher
After=graphical-session.target

[Service]
WorkingDirectory=%h/.local/bin/satty-watcher
ExecStart=%h/.local/bin/satty-watcher/satty-watcher
Restart=always
RestartSec=3

[Install]
WantedBy=default.target

```


3. **Enable and Start:**
```bash
systemctl --user daemon-reload
systemctl --user enable --now satty-watcher.service

```



---

### 🔍 Features

* **Loop Protection:** Uses a JSON cache to track filenames. If you save/overwrite a file within Satty, the watcher recognizes the filename and ignores the "Update" event.
* **Auto-Cleanup:** Every time a new file is processed, the script automatically purges entries from the cache that are older than 24 hours.
* **Environment Managed:** All paths are configurable via the `.env` file.

### 📋 Useful Commands

* **Check logs:** `journalctl --user -u satty-watcher.service -f`
* **Restart service:** `systemctl --user restart satty-watcher.service`
* **Stop service:** `systemctl --user stop satty-watcher.service`

