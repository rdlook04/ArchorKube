# ArchorKube Ollama Bridge

Send a finding from ArchorKube to your **local** Ollama and get the analysis back, without the data going through Dynatrace or any cloud.

## Why a bridge

Dynatrace apps can only connect to Dynatrace: the platform's Content Security Policy blocks `fetch` to `localhost`, and apps can't extend `connect-src`. What an app *can* do is open a window. This page runs on your machine, receives the prompt through `postMessage`, and calls Ollama from here.

```
ArchorKube (tenant) ──window.open──▶ bridge (localhost:8765) ──fetch──▶ Ollama (localhost:11434)
                    ◀── ready ─────
                    ── prompt ────▶
```

## Run it

1. Have [Ollama](https://ollama.com) running with at least one model (`ollama pull gemma2:9b`).
2. Serve this folder on port 8765:
   ```bash
   python -m http.server 8765 --bind 127.0.0.1
   ```
3. In ArchorKube, open a row's menu and choose **Send to local Ollama**. Allow pop-ups for the app the first time.

You can also open `http://localhost:8765/` directly and paste a prompt.

## What it protects

- **Origin allowlist.** Only `*.apps.dynatrace.com` and the local dev server (`localhost:3000–3005`) can send prompts. Any other page that opens the bridge is rejected. To add your own origin, set `archorkube.bridge.origins` in this page's localStorage to a JSON list of regex patterns.
- **You see what arrived.** The received prompt is shown (and editable) under *Prompt received*.
- **Commands are classified by rules, not by the model.** Every `kubectl`/`helm` line in the answer gets a badge: *read-only*, *changes the cluster* or *destructive*.

## Settings

- A different bridge URL for the app: set `archorkube.bridge.url` in the ArchorKube tab's localStorage (default `http://localhost:8765/`).
- Ollama already accepts `localhost` origins by default. If you serve the bridge from another host, add it to `OLLAMA_ORIGINS`.
