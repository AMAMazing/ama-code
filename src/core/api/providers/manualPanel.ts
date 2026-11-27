import * as http from "node:http"
import * as vscode from "vscode"
import { Logger } from "@/shared/services/Logger"
import { openExternal, readTextFromClipboard, writeTextToClipboard } from "@/utils/env"

export interface ManualModeSnapshot {
	waiting: boolean
	version: number
	prompt: string
	promptChars: number
	queuedTools: number
	autoCopied: boolean
	statusNote: string
	bridgeUrl: string | null
}

export interface ManualPanelCallbacks {
	getSnapshot: () => ManualModeSnapshot
	submitResponse: (rawText: string) => { ok: boolean; batchCount?: number; error?: string }
	clearQueue: () => void
	cancelPending: (reason?: string) => void
}

function buildManualPanelHtml(isBrowserMode: boolean): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AMA Code — Manual Mode</title>
<style>
  :root {
    --bg: var(--vscode-editor-background, #0d1117);
    --surface: var(--vscode-sideBar-background, #161b22);
    --fg: var(--vscode-editor-foreground, #e6edf3);
    --muted: var(--vscode-descriptionForeground, #8b949e);
    --border: var(--vscode-panel-border, #30363d);
    --input-bg: var(--vscode-input-background, #0d1117);
    --input-fg: var(--vscode-input-foreground, #c9d1d9);
    --btn-bg: var(--vscode-button-background, #238636);
    --btn-fg: var(--vscode-button-foreground, #ffffff);
    --btn-hover: var(--vscode-button-hoverBackground, #2ea043);
    --btn-sec-bg: var(--vscode-button-secondaryBackground, #21262d);
    --btn-sec-fg: var(--vscode-button-secondaryForeground, #c9d1d9);
    --focus: var(--vscode-focusBorder, #1f6feb);
    --danger: var(--vscode-errorForeground, #f85149);
    --ok: var(--vscode-testing-iconPassed, #238636);
  }
  * { box-sizing: border-box; font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif); }
  body { background: var(--bg); color: var(--fg); margin: 0; padding: 16px; max-width: 1120px; margin-inline: auto; }
  .header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  h1 { margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
  .badge.waiting { background: var(--ok); color: #fff; animation: pulse 1.5s infinite; }
  .badge.idle { background: var(--btn-sec-bg); color: var(--muted); border: 1px solid var(--border); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.65; } }
  .toast { font-size: 12px; color: var(--focus); min-height: 18px; margin-bottom: 12px; }
  .toast.error { color: var(--danger); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .card-title { margin: 0; font-size: 13px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .meta { font-size: 11px; color: var(--muted); font-weight: 400; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn { border: 1px solid transparent; border-radius: 6px; padding: 9px 13px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 1; min-width: 140px; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--btn-bg); color: var(--btn-fg); }
  .btn-primary:hover:not(:disabled) { background: var(--btn-hover); }
  .btn-accent { background: var(--focus); color: #fff; }
  .btn-accent:hover:not(:disabled) { filter: brightness(1.1); }
  .btn-secondary { background: var(--btn-sec-bg); color: var(--btn-sec-fg); border-color: var(--border); font-weight: 500; }
  .btn-secondary:hover:not(:disabled) { border-color: var(--focus); }
  .btn-danger { background: transparent; color: var(--danger); border-color: var(--border); font-weight: 500; flex: 0 0 auto; min-width: auto; }
  .btn-danger:hover:not(:disabled) { border-color: var(--danger); }
  textarea { width: 100%; min-height: 290px; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--border); border-radius: 6px; padding: 10px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11.5px; line-height: 1.45; resize: vertical; }
  textarea:focus { outline: 1px solid var(--focus); border-color: var(--focus); }
  .footer-bar { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--muted); }
  .link-btn { background: none; border: none; color: var(--focus); cursor: pointer; padding: 0; font-size: 11.5px; text-decoration: underline; }
</style>
</head>
<body>
  <div class="header">
    <h1>
      <span>⚡ AMA Code Manual Mode</span>
      <span id="statusBadge" class="badge idle">Idle</span>
    </h1>
    <div class="row" style="flex:0 0 auto;">
      <button id="clearQueueBtn" class="btn btn-secondary" style="flex:0 0 auto;min-width:auto;padding:5px 10px;display:none;" onclick="clearQueue()">Clear Queue</button>
      <button id="cancelBtn" class="btn btn-danger" style="padding:5px 10px;display:none;" onclick="cancelRequest()">Cancel Request</button>
    </div>
  </div>
  <div class="toast" id="toast">Ready. Send a task in AMA Code to compile a prompt.</div>

  <div class="grid">
    <div class="card">
      <div class="card-title">
        <span>1. Outgoing Prompt</span>
        <span class="meta" id="promptMeta">0 chars</span>
      </div>
      <button class="btn btn-accent" onclick="copyPrompt()">📋 Copy Full Prompt to Clipboard</button>
      <textarea id="promptBox" readonly placeholder="When AMA Code sends a request in Manual Mode, the compiled prompt + unified rules will appear here..."></textarea>
    </div>

    <div class="card">
      <div class="card-title">
        <span>2. LLM Response Back to AMA Code</span>
        <span class="meta">Ctrl+Enter to send</span>
      </div>
      <button id="pasteSendBtn" class="btn btn-primary" onclick="pasteAndSend()">🚀 Paste Clipboard & Send to AMA Code</button>
      <textarea id="responseBox" placeholder="Or paste/edit the LLM response here and click Send Textarea Response..."></textarea>
      <button id="sendManualBtn" class="btn btn-secondary" onclick="sendManualText()">Send Textarea Response</button>
    </div>
  </div>

  <div class="footer-bar">
    <span id="queueInfo">Queued batched tools: 0</span>
    <span id="bridgeWrap" style="display:none;">
      Browser bridge: <button id="bridgeLink" class="link-btn" onclick="openBridge()"></button>
    </span>
  </div>

<script>
  const IS_BROWSER = ${isBrowserMode ? "true" : "false"};
  const vscodeApi = !IS_BROWSER && typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
  let currentVersion = 0;

  function showToast(msg, isError) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = isError ? "toast error" : "toast";
  }

  function applyState(data) {
    if (!data) return;
    const badge = document.getElementById("statusBadge");
    const cancelBtn = document.getElementById("cancelBtn");
    const clearQueueBtn = document.getElementById("clearQueueBtn");
    const pasteSendBtn = document.getElementById("pasteSendBtn");
    const sendManualBtn = document.getElementById("sendManualBtn");

    if (data.waiting) {
      badge.className = "badge waiting";
      badge.textContent = "🟢 Waiting for LLM Response (Prompt #" + data.version + ")";
      cancelBtn.style.display = "inline-flex";
      pasteSendBtn.disabled = false;
      sendManualBtn.disabled = false;
    } else {
      badge.className = "badge idle";
      badge.textContent = data.queuedTools > 0 ? "⚡ Executing Batch (" + data.queuedTools + " left)" : "Idle";
      cancelBtn.style.display = "none";
      pasteSendBtn.disabled = true;
      sendManualBtn.disabled = true;
    }

    clearQueueBtn.style.display = data.queuedTools > 0 ? "inline-flex" : "none";
    document.getElementById("queueInfo").textContent = "Queued batched tools: " + (data.queuedTools || 0);
    document.getElementById("promptMeta").textContent = (data.promptChars || 0).toLocaleString() + " chars";

    const bridgeWrap = document.getElementById("bridgeWrap");
    const bridgeLink = document.getElementById("bridgeLink");
    if (data.bridgeUrl) {
      bridgeWrap.style.display = "inline";
      bridgeLink.textContent = data.bridgeUrl;
    } else {
      bridgeWrap.style.display = "none";
    }

    if (data.version > currentVersion && data.prompt) {
      currentVersion = data.version;
      document.getElementById("promptBox").value = data.prompt;
      if (IS_BROWSER) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(data.prompt)
            .then(() => showToast("✅ Prompt #" + data.version + " compiled & copied to clipboard!"))
            .catch(() => showToast("📥 Prompt #" + data.version + " ready! Click Copy Full Prompt."));
        } else {
          showToast("📥 Prompt #" + data.version + " ready! Click Copy Full Prompt.");
        }
      } else {
        showToast(data.statusNote || ("✅ Prompt #" + data.version + " ready."));
      }
    } else if (!data.waiting && data.statusNote) {
      showToast(data.statusNote);
    }
  }

  async function copyPrompt() {
    const text = document.getElementById("promptBox").value;
    if (!text) return showToast("No prompt compiled yet.", true);
    if (vscodeApi) {
      vscodeApi.postMessage({ type: "copyPrompt" });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("✅ Full prompt copied to clipboard!");
    } catch {
      showToast("Browser blocked clipboard write. Select & copy from the left box.", true);
    }
  }

  async function pasteAndSend() {
    if (vscodeApi) {
      vscodeApi.postMessage({ type: "pasteAndSend" });
      return;
    }
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText.trim()) return showToast("Clipboard is empty!", true);
      document.getElementById("responseBox").value = clipText;
      await submitViaHttp(clipText);
    } catch {
      showToast("Browser blocked clipboard read. Paste into the right box and click Send Textarea Response.", true);
    }
  }

  async function sendManualText() {
    const text = document.getElementById("responseBox").value;
    if (!text.trim()) return showToast("Response textarea is empty!", true);
    if (vscodeApi) {
      vscodeApi.postMessage({ type: "sendResponse", text });
      return;
    }
    await submitViaHttp(text);
  }

  async function submitViaHttp(text) {
    try {
      const res = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: text })
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById("responseBox").value = "";
        showToast("🚀 Sent to AMA Code! (" + data.batchCount + " tool step(s) parsed)");
      } else {
        showToast(data.error || "Failed to send response.", true);
      }
    } catch (e) {
      showToast("Error sending response: " + e.message, true);
    }
  }

  function clearQueue() {
    if (vscodeApi) {
      vscodeApi.postMessage({ type: "clearQueue" });
    } else {
      fetch("/api/clear-queue", { method: "POST" }).catch(() => {});
    }
  }

  function cancelRequest() {
    if (vscodeApi) {
      vscodeApi.postMessage({ type: "cancelRequest" });
    } else {
      fetch("/api/cancel", { method: "POST" }).catch(() => {});
    }
  }

  function openBridge() {
    if (vscodeApi) {
      vscodeApi.postMessage({ type: "openBrowserBridge" });
    }
  }

  document.getElementById("responseBox").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendManualText();
    }
  });

  if (vscodeApi) {
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === "state") {
        applyState(msg.state);
      } else if (msg.type === "toast") {
        showToast(msg.text, msg.level === "error");
      } else if (msg.type === "submitted") {
        if (msg.ok) {
          document.getElementById("responseBox").value = "";
          showToast("🚀 Sent to AMA Code! (" + msg.batchCount + " tool step(s) parsed)");
        } else {
          showToast(msg.error || "Failed to send response.", true);
        }
      }
    });
    vscodeApi.postMessage({ type: "ready" });
  } else {
    async function poll() {
      try {
        const res = await fetch("/api/state");
        const data = await res.json();
        applyState(data);
      } catch {}
    }
    setInterval(poll, 750);
    poll();
  }
</script>
</body>
</html>`
}

export class ManualModePanelController {
	private panel: vscode.WebviewPanel | undefined
	private httpServer: http.Server | undefined
	private activePort: number | undefined
	private callbacks: ManualPanelCallbacks

	constructor(callbacks: ManualPanelCallbacks) {
		this.callbacks = callbacks
	}

	public getBridgeUrl(): string | null {
		return this.activePort ? `http://127.0.0.1:${this.activePort}` : null
	}

	public showPanel(preserveFocus = true): void {
		if (!vscode?.window?.createWebviewPanel) {
			return
		}
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.Beside, preserveFocus)
			this.pushState()
			return
		}

		this.panel = vscode.window.createWebviewPanel(
			"amaCode.manualModePanel",
			"AMA Code — Manual Mode",
			{ viewColumn: vscode.ViewColumn.Beside, preserveFocus },
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			},
		)

		this.panel.webview.html = buildManualPanelHtml(false)

		this.panel.webview.onDidReceiveMessage(async (msg: { type?: string; text?: string }) => {
			if (!msg?.type) {
				return
			}
			switch (msg.type) {
				case "ready": {
					this.pushState()
					break
				}
				case "copyPrompt": {
					const snap = this.callbacks.getSnapshot()
					if (!snap.prompt) {
						this.postToast("No prompt compiled yet.", "error")
						return
					}
					try {
						await writeTextToClipboard(snap.prompt)
						this.postToast("✅ Full prompt copied to clipboard!", "success")
					} catch (err) {
						this.postToast(`Failed to copy to clipboard: ${err instanceof Error ? err.message : String(err)}`, "error")
					}
					break
				}
				case "pasteAndSend": {
					try {
						const clipText = await readTextFromClipboard()
						if (!clipText || !clipText.trim()) {
							this.postToast("Clipboard is empty. Copy the LLM response first.", "error")
							return
						}
						const result = this.callbacks.submitResponse(clipText)
						void this.panel?.webview.postMessage({ type: "submitted", ...result })
					} catch (err) {
						this.postToast(`Failed to read clipboard: ${err instanceof Error ? err.message : String(err)}`, "error")
					}
					break
				}
				case "sendResponse": {
					const result = this.callbacks.submitResponse(String(msg.text || ""))
					void this.panel?.webview.postMessage({ type: "submitted", ...result })
					break
				}
				case "clearQueue": {
					this.callbacks.clearQueue()
					this.postToast("Cleared queued batched tool calls.", "success")
					break
				}
				case "cancelRequest": {
					this.callbacks.cancelPending("Manual Mode request cancelled by user.")
					this.postToast("Cancelled waiting request.", "success")
					break
				}
				case "openBrowserBridge": {
					const url = this.getBridgeUrl()
					if (url) {
						await openExternal(url)
					}
					break
				}
			}
		})

		this.panel.onDidDispose(() => {
			this.panel = undefined
		})
	}

	public pushState(): void {
		if (!this.panel) {
			return
		}
		void this.panel.webview.postMessage({
			type: "state",
			state: this.callbacks.getSnapshot(),
		})
	}

	private postToast(text: string, level: "success" | "error"): void {
		if (!this.panel) {
			return
		}
		void this.panel.webview.postMessage({ type: "toast", text, level })
	}

	public ensureHttpBridge(enabled: boolean, requestedPort: number): void {
		if (!enabled) {
			this.stopHttpBridge()
			return
		}

		const safePort =
			Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535 ? requestedPort : 4000

		if (this.httpServer && this.activePort === safePort) {
			return
		}

		this.stopHttpBridge()

		const server = http.createServer((req, res) => {
			if (req.method === "OPTIONS") {
				res.writeHead(204, {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "*",
				})
				res.end()
				return
			}

			if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
				res.end(buildManualPanelHtml(true))
				return
			}

			if (req.method === "GET" && req.url === "/api/state") {
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				})
				res.end(JSON.stringify(this.callbacks.getSnapshot()))
				return
			}

			if (req.method === "POST" && req.url === "/api/respond") {
				let body = ""
				req.on("data", (chunk) => {
					body += chunk
				})
				req.on("end", () => {
					try {
						const parsed = JSON.parse(body || "{}") as { response?: string }
						const result = this.callbacks.submitResponse(parsed.response || "")
						res.writeHead(result.ok ? 200 : 400, {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						})
						res.end(JSON.stringify(result))
					} catch (err) {
						res.writeHead(500, { "Content-Type": "application/json" })
						res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }))
					}
				})
				return
			}

			if (req.method === "POST" && req.url === "/api/clear-queue") {
				this.callbacks.clearQueue()
				res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ ok: true }))
				return
			}

			if (req.method === "POST" && req.url === "/api/cancel") {
				this.callbacks.cancelPending("Manual Mode request cancelled from browser control panel.")
				res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ ok: true }))
				return
			}

			res.writeHead(404)
			res.end("Not Found")
		})

		server.on("error", (err: NodeJS.ErrnoException) => {
			Logger.warn(`[AMA Code Manual Mode] Local HTTP bridge failed on port ${safePort}: ${err.message}`)
			if (this.httpServer === server) {
				this.httpServer = undefined
				this.activePort = undefined
				this.pushState()
			}
		})

		server.listen(safePort, "127.0.0.1", () => {
			this.httpServer = server
			this.activePort = safePort
			Logger.log(`[AMA Code Manual Mode] Browser control panel listening on http://127.0.0.1:${safePort}`)
			this.pushState()
		})
	}

	public stopHttpBridge(): void {
		if (this.httpServer) {
			try {
				this.httpServer.close()
			} catch {
				// Ignore close errors
			}
			this.httpServer = undefined
			this.activePort = undefined
			this.pushState()
		}
	}

	public dispose(): void {
		this.stopHttpBridge()
		if (this.panel) {
			try {
				this.panel.dispose()
			} catch {
				// Ignore dispose errors
			}
			this.panel = undefined
		}
	}
}