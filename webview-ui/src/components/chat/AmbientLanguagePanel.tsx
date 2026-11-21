import { ChevronDown, ChevronUp, Maximize2, Minimize2, Pin, PinOff, RotateCw } from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ambientCoreAssets from "virtual:ambient-core"

interface AmbientLanguagePanelProps {
	isAgentWaiting: boolean
}

type AmbientPersistedState = Record<string, unknown>

const AUTO_OPEN_STORAGE_KEY = "amaCode.ambientLanguage.autoOpen"
const EXPANDED_STORAGE_KEY = "amaCode.ambientLanguage.expanded"
const AMBIENT_STATE_STORAGE_KEY = "ambientThai.v2"
const AMP = String.fromCharCode(38)

let cachedAmbientState: AmbientPersistedState | null = null
let cachedAutoOpen: boolean | null = null
let cachedIsExpanded: boolean | null = null

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, `${AMP}amp;`)
		.replace(/"/g, `${AMP}quot;`)
		.replace(/</g, `${AMP}lt;`)
		.replace(/>/g, `${AMP}gt;`)
}

function escapeInlineStyle(css: string): string {
	return css.replace(/<\/style/gi, "<\\/style")
}

function escapeInlineScript(js: string): string {
	return js.replace(/<\/script/gi, "<\\/script")
}

function serializeInlineJson(value: unknown): string {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029")
}

function readMetaContent(name: string, fallback: string): string {
	if (typeof document === "undefined") {
		return fallback
	}
	const meta = document.querySelector(`meta[name="${name}"]`)
	return meta?.getAttribute("content") || fallback
}

function readBooleanPreference(key: string, cached: boolean | null, fallback: boolean): boolean {
	if (cached !== null) {
		return cached
	}
	try {
		const stored = localStorage.getItem(key)
		return stored === null ? fallback : stored === "true"
	} catch {
		return fallback
	}
}

function writeBooleanPreference(key: string, value: boolean): void {
	try {
		localStorage.setItem(key, String(value))
	} catch {
		// Ignore storage errors
	}
}

function loadSavedAmbientState(): AmbientPersistedState | null {
	if (cachedAmbientState) {
		return { ...cachedAmbientState, m: "A" }
	}
	try {
		const raw = localStorage.getItem(AMBIENT_STATE_STORAGE_KEY)
		if (!raw) {
			return null
		}
		const parsed = JSON.parse(raw)
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			const normalized = { ...(parsed as AmbientPersistedState), m: "A" }
			cachedAmbientState = normalized
			return { ...normalized }
		}
	} catch {
		// Ignore storage/parse errors
	}
	return null
}

function saveAmbientState(state: AmbientPersistedState): void {
	const normalized: AmbientPersistedState = { ...state, m: "A" }
	cachedAmbientState = normalized
	try {
		localStorage.setItem(AMBIENT_STATE_STORAGE_KEY, JSON.stringify(normalized))
	} catch {
		// Ignore storage errors
	}
}

const SIDEBAR_OVERRIDE_CSS = `
    html, body {
      height: 100%;
      overflow: hidden;
      background: var(--bg);
      color: var(--tx);
    }

    * {
      scrollbar-width: thin;
      scrollbar-color: var(--line) transparent;
    }

    /* Always keep single-column sidebar focus layout (no web Media/PiP Zone) */
    #app,
    body.B #app {
      height: 100%;
      gap: 8px;
      padding: 8px;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas:
        "bar"
        "stage"
        "kb";
    }

    #pip,
    body.B #pip,
    #feed,
    body.B #feed {
      display: none !important;
    }

    /* Slim Companion Website Header tuned for VS Code sidebar width */
    #bar.hdr2 {
      gap: 6px;
      font-size: 11px;
      flex-wrap: nowrap;
      min-height: 28px;
    }

    #bar.hdr2 .l {
      min-width: 0;
      gap: 6px;
      overflow: hidden;
    }

    #bar.hdr2 .brand {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    #bar.hdr2 #cnt {
      font-size: 10px;
      padding-left: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #bar.hdr2 .r {
      gap: 5px;
    }

    #bar.hdr2 #trophbtn,
    #bar.hdr2 #setbtn {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 11px;
      line-height: 1.2;
      color: var(--tx);
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }

    #bar.hdr2 #trophbtn:hover,
    #bar.hdr2 #setbtn:hover {
      border-color: var(--acc);
    }

    #bar.hdr2 #trophbtn.on,
    #bar.hdr2 #setbtn.on {
      background: #162230;
      border-color: var(--acc);
      color: var(--acc);
    }

    #bar.hdr2 #setbtn .lbl {
      display: none;
    }

    @media (min-width: 370px) {
      #bar.hdr2 #setbtn .lbl {
        display: inline;
      }
    }

    /* Settings Popover (Reading, Clues, Script, Sound, Replay Tutorial) */
    #settings {
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      width: auto;
      padding: 10px;
      gap: 8px;
      border-radius: 12px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.65);
      max-height: calc(100vh - 50px);
      overflow-y: auto;
    }

    #settings .srow {
      gap: 8px;
    }

    #settings .slabel {
      flex: 0 0 54px;
      font-size: 10px;
      letter-spacing: 0.06em;
    }

    #settings .seg {
      border-radius: 7px;
      background: var(--bg);
    }

    #settings .seg button {
      padding: 5px 6px;
      font-size: 11px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #settings .srow-end {
      padding-top: 8px;
      justify-content: flex-end;
    }

    #settings #replaytut {
      width: 100%;
      padding: 6px 10px;
      font-size: 11px;
      background: var(--bg);
      color: var(--dim);
      border-radius: 7px;
      transition: border-color 0.15s, color 0.15s;
    }

    #settings #replaytut:hover {
      border-color: var(--acc);
      color: var(--tx);
    }

    /* Main Flashcard & Wordle Stage */
    #stage,
    body.B #stage:not(.trophy-mode) {
      border-radius: 12px;
      padding: 10px 10px;
      gap: 7px;
      justify-content: center;
      overflow-y: auto;
    }

    .badge {
      font-size: 10px;
      padding: 2px 8px;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .glyph,
    body.B .glyph {
      font-size: clamp(46px, 16vh, 92px);
      line-height: 1.1;
    }

    .word,
    body.B .word {
      font-size: clamp(32px, 11vh, 62px);
      line-height: 1.12;
    }

    .emo-reveal {
      gap: 2px;
    }

    .emo-hero {
      font-size: clamp(28px, 8.5vh, 48px);
    }

    .emo-tag {
      font-size: 10px;
    }

    .hook,
    .hint {
      font-size: 11.5px;
      line-height: 1.38;
      max-width: 100%;
      min-height: 1.3em;
    }

    .syl-chip {
      font-size: 11px;
      padding: 2px 6px;
    }

    .rule-pill {
      font-size: 10px;
      padding: 1px 6px;
    }

    .buf {
      font-size: clamp(18px, 4.5vh, 24px);
      letter-spacing: 0.16em;
      min-height: 1.15em;
    }

    .grid {
      gap: 4px;
      padding: 1px;
    }

    .gr {
      gap: 4px;
    }

    .t {
      width: clamp(22px, 6.2vw, 34px);
      font-size: clamp(12px, 3.1vw, 17px);
      border-radius: 6px;
      border-width: 1.5px;
    }

    #hintbtn {
      padding: 3px 11px;
      font-size: 11px;
      transition: border-color 0.15s, color 0.15s;
    }

    #hintbtn:hover {
      border-color: var(--acc);
      color: var(--tx);
    }

    /* Compact Virtual Keyboard tailored for narrow VS Code sidebars */
    #kb,
    body.B #kb {
      gap: 4px;
      align-self: stretch;
    }

    .row {
      gap: 3px;
    }

    .k,
    body.B .k {
      min-width: 0;
      padding: 0;
      height: clamp(28px, 6.2vh, 38px);
      font-size: 13px;
      border-radius: 7px;
      transition: background 0.1s, transform 0.08s;
    }

    .k:hover {
      background: #283140;
    }

    .k:active {
      transform: translateY(1px);
    }

    .k.go:hover {
      background: #1c445d;
    }

    /* Emoji Trophy Case tuned for VS Code sidebar */
    #stage.trophy-mode {
      padding: 10px;
      gap: 8px;
      overflow: hidden;
      justify-content: flex-start;
      align-items: stretch;
    }

    .tr-head {
      padding-bottom: 6px;
      gap: 6px;
    }

    .tr-stats {
      font-size: 11px;
      gap: 4px 8px;
      flex-wrap: wrap;
    }

    .tr-controls {
      gap: 5px;
      width: 100%;
    }

    #trfseg button {
      padding: 4px 7px;
      font-size: 11px;
    }

    .tr-search {
      flex: 1 1 88px;
      min-width: 72px;
      width: auto;
      font-size: 11px;
      padding: 4px 7px;
    }

    .tr-detail {
      padding: 7px 9px;
      min-height: 44px;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 11px;
    }

    .tr-detail .th-big {
      font-size: 17px;
    }

    .tr-grid {
      min-height: 0;
      grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
      gap: 5px;
    }

    .tr-cell {
      border-radius: 7px;
    }

    .tr-cell .e {
      font-size: 18px;
    }

    .tr-cell .l {
      font-size: 8.5px;
    }

    .tr-more {
      padding: 7px;
      font-size: 11px;
    }
`

function buildPreBridgeScript(initialState: AmbientPersistedState | null): string {
	const serializedInitialState = serializeInlineJson(initialState)
	return `(function () {
  window.__AMBIENT_INITIAL_STATE__ = ${serializedInitialState};
  window.__AMBIENT_BOOTING__ = true;

  if (typeof acquireVsCodeApi !== "function" && window.parent && window.parent !== window) {
    window.acquireVsCodeApi = function () {
      return {
        postMessage: function (msg) {
          if (window.__AMBIENT_BOOTING__) {
            return;
          }
          try {
            if (msg && msg.state) {
              msg.state.m = "A";
            }
            window.parent.postMessage(msg, "*");
          } catch (e) {}
        },
      };
    };
  }
})();`
}

const POST_SYNC_BRIDGE_JS = `(function () {
  if (typeof AmbientSync !== "undefined" && typeof mergeStates === "function") {
    var origLoadInitial = AmbientSync.loadInitial.bind(AmbientSync);
    AmbientSync.loadInitial = function (defaultState) {
      var safeDefault = Object.assign({}, defaultState, { updatedAt: 0 });
      var initial = window.__AMBIENT_INITIAL_STATE__;
      if (initial && typeof initial === "object") {
        var hydrated = mergeStates(
          safeDefault,
          Object.assign({}, initial, {
            m: "A",
            updatedAt: Math.max(initial.updatedAt || 0, Date.now()),
          })
        );
        hydrated.m = "A";
        return hydrated;
      }
      var loaded = origLoadInitial(safeDefault);
      loaded.m = "A";
      return loaded;
    };
  }
})();`

const POST_APP_BRIDGE_JS = `(function () {
  window.__AMBIENT_BOOTING__ = false;
})();`

function buildAmbientSrcDoc(nonce: string, initialState: AmbientPersistedState | null): string {
	const nonceAttr = nonce ? ` nonce="${escapeAttr(nonce)}"` : ""
	const inlineCoreCss = escapeInlineStyle(ambientCoreAssets.styleCss)
	const inlineOverrideCss = escapeInlineStyle(SIDEBAR_OVERRIDE_CSS)

	const scripts = [
		buildPreBridgeScript(initialState),
		ambientCoreAssets.phoneticsJs,
		ambientCoreAssets.tutorialJs,
		ambientCoreAssets.emojisJs,
		ambientCoreAssets.syncJs,
		POST_SYNC_BRIDGE_JS,
		ambientCoreAssets.appJs,
		POST_APP_BRIDGE_JS,
	]
		.filter(Boolean)
		.map((scriptContent) => `<script${nonceAttr}>\n${escapeInlineScript(scriptContent)}\n</script>`)
		.join("\n  ")

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Noto+Sans+Thai:wght@500;700&family=Noto+Sans+Thai+Looped:wght@500;700&display=swap" rel="stylesheet">
  <style>
${inlineCoreCss}
${inlineOverrideCss}
  </style>
</head>
<body class="A">
  <div id="app">
    <div id="bar" class="hdr2">
      <div class="l">
        <span class="brand">🇹🇭 ambient thai</span>
        <span id="cnt">tutorial</span>
      </div>
      <div class="r">
        <button id="trophbtn" title="View Emoji Trophies" type="button">🏆 <span id="trophcnt">0</span></button>
        <button aria-controls="settings" aria-expanded="false" id="setbtn" title="Settings" type="button">⚙ <span class="lbl">Settings</span></button>
      </div>
      <div aria-label="Settings" hidden id="settings" role="dialog">
        <div class="srow">
          <span class="slabel">Reading</span>
          <div aria-label="Phonetics mode" class="seg" id="pseg">
            <button data-p="real" title="True Thai syllable reading order and final consonant sounds" type="button">Real Thai</button>
            <button data-p="literal" title="Strict left-to-right 1:1 character cipher" type="button">Literal 1:1</button>
          </div>
        </div>
        <div class="srow">
          <span class="slabel">Clues</span>
          <div aria-label="Clue mode" class="seg" id="cseg">
            <button data-c="mystery" title="Reveal the emoji after solving" type="button">Mystery 🏆</button>
            <button data-c="learn" title="Show emoji + meaning while typing" type="button">Learn 💡</button>
          </div>
        </div>
        <div class="srow">
          <span class="slabel">Script</span>
          <div aria-label="Thai script style" class="seg" id="fseg">
            <button data-f="modern" type="button">Modern</button>
            <button data-f="looped" type="button">Trad</button>
            <button data-f="mix" type="button">Mix</button>
          </div>
        </div>
        <div class="srow">
          <span class="slabel">Sound</span>
          <div aria-label="Sound mode" class="seg" id="sseg">
            <button data-s="off" title="Mute all audio" type="button">🔇 Off</button>
            <button data-s="dings" title="Warm harmonic chimes and tactile clicks" type="button">🔔 Dings</button>
            <button data-s="voice" title="Speak Thai word aloud on completion" type="button">🗣️ Spoken</button>
          </div>
        </div>
        <div class="srow srow-end">
          <button id="replaytut" title="Restart the 15-character guided tutorial" type="button">↺ Replay Tutorial</button>
        </div>
      </div>
    </div>
    <main id="stage"></main>
    <div id="kb"></div>
  </div>
  ${scripts}
</body>
</html>`
}

export const AmbientLanguagePanel: React.FC<AmbientLanguagePanelProps> = ({ isAgentWaiting }) => {
	const [autoOpen, setAutoOpen] = useState<boolean>(() => readBooleanPreference(AUTO_OPEN_STORAGE_KEY, cachedAutoOpen, true))
	const [isOpen, setIsOpen] = useState<boolean>(false)
	const [isPinned, setIsPinned] = useState<boolean>(false)
	const [isExpanded, setIsExpanded] = useState<boolean>(() =>
		readBooleanPreference(EXPANDED_STORAGE_KEY, cachedIsExpanded, false),
	)
	const [reloadTick, setReloadTick] = useState<number>(0)
	const wasWaitingRef = useRef<boolean>(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)

	useEffect(() => {
		const prevWaiting = wasWaitingRef.current
		wasWaitingRef.current = isAgentWaiting

		if (isAgentWaiting && !prevWaiting) {
			if (autoOpen) {
				setIsOpen(true)
			}
		} else if (!isAgentWaiting && prevWaiting) {
			if (!isPinned) {
				setIsOpen(false)
			}
		}
	}, [isAgentWaiting, autoOpen, isPinned])

	useEffect(() => {
		const handleIframeMessage = (event: MessageEvent) => {
			if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
				return
			}
			const data = event.data
			if (data && data.type === "AMBIENT_SAVE_STATE" && data.state && typeof data.state === "object") {
				saveAmbientState(data.state as AmbientPersistedState)
			}
		}
		window.addEventListener("message", handleIframeMessage)
		return () => {
			window.removeEventListener("message", handleIframeMessage)
		}
	}, [])

	const toggleAutoOpen = useCallback(() => {
		setAutoOpen((prev) => {
			const next = !prev
			cachedAutoOpen = next
			writeBooleanPreference(AUTO_OPEN_STORAGE_KEY, next)
			return next
		})
	}, [])

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => {
			const next = !prev
			cachedIsExpanded = next
			writeBooleanPreference(EXPANDED_STORAGE_KEY, next)
			return next
		})
	}, [])

	const handleToggleOpen = useCallback(() => {
		setIsOpen((prev) => {
			const next = !prev
			if (!next) {
				setIsPinned(false)
			}
			return next
		})
	}, [])

	const srcDoc = useMemo(() => {
		if (!isOpen) {
			return ""
		}
		const nonce = readMetaContent("csp-nonce", "")
		return buildAmbientSrcDoc(nonce, loadSavedAmbientState())
	}, [isOpen, reloadTick])

	if (!isAgentWaiting && !isOpen) {
		return null
	}

	if (!isOpen) {
		return (
			<div className="px-2.5 pt-1.5">
				<button
					className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-[#252d39] bg-[#141922] text-[11px] text-[#9aa4b2] hover:text-[#e8ecf1] hover:border-[#5cc8ff]/50 transition-colors cursor-pointer"
					onClick={handleToggleOpen}
					title="Play Ambient Thai flashcards while waiting for the agent"
					type="button">
					<span className="flex items-center gap-1.5 truncate">
						<span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
						<span className="truncate font-medium text-[#e8ecf1]">🇹🇭 Ambient Thai</span>
						<span className="text-[#7d8896] truncate">· Play while waiting</span>
					</span>
					<ChevronUp className="w-3.5 h-3.5 shrink-0" />
				</button>
			</div>
		)
	}

	return (
		<div className="px-2.5 pt-1.5">
			<div className="rounded-lg overflow-hidden border border-[#252d39] bg-[#0d1015] shadow-lg flex flex-col">
				<div className="flex items-center justify-between gap-1.5 px-2.5 py-1 bg-[#141922] border-b border-[#252d39] text-[11px] text-[#9aa4b2] select-none">
					<div className="flex items-center gap-1.5 min-w-0">
						<span
							className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
								isAgentWaiting ? "bg-sky-400 animate-pulse" : "bg-emerald-400"
							}`}
						/>
						<span className="truncate font-medium text-[#e8ecf1]">
							{isAgentWaiting ? "Waiting on agent" : "Agent ready"}
						</span>
					</div>
					<div className="flex items-center gap-0.5 shrink-0">
						<button
							className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer transition-colors ${
								autoOpen
									? "border-[#5cc8ff]/45 bg-[#162230] text-[#5cc8ff]"
									: "border-[#252d39] bg-transparent text-[#7d8896] hover:text-[#e8ecf1]"
							}`}
							onClick={toggleAutoOpen}
							title={autoOpen ? "Auto-open while waiting: ON" : "Auto-open while waiting: OFF"}
							type="button">
							Auto
						</button>
						<button
							className={`p-1 rounded hover:bg-[#1f2630] cursor-pointer transition-colors ${
								isPinned ? "text-[#5cc8ff]" : "text-[#7d8896] hover:text-[#e8ecf1]"
							}`}
							onClick={() => setIsPinned((prev) => !prev)}
							title={isPinned ? "Unpin (auto-hide when agent responds)" : "Pin open after agent responds"}
							type="button">
							{isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
						</button>
						<button
							className="p-1 rounded hover:bg-[#1f2630] text-[#7d8896] hover:text-[#e8ecf1] cursor-pointer transition-colors"
							onClick={() => setReloadTick((t) => t + 1)}
							title="Reload flashcards"
							type="button">
							<RotateCw className="w-3 h-3" />
						</button>
						<button
							className="p-1 rounded hover:bg-[#1f2630] text-[#7d8896] hover:text-[#e8ecf1] cursor-pointer transition-colors"
							onClick={toggleExpanded}
							title={isExpanded ? "Compact height" : "Expand height"}
							type="button">
							{isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
						</button>
						<button
							className="p-1 rounded hover:bg-[#1f2630] text-[#7d8896] hover:text-[#e8ecf1] cursor-pointer transition-colors"
							onClick={handleToggleOpen}
							title="Minimize flashcards"
							type="button">
							<ChevronDown className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
				<iframe
					className="w-full border-0 block bg-[#0d1015]"
					key={reloadTick}
					ref={iframeRef}
					srcDoc={srcDoc}
					style={{ height: isExpanded ? "min(520px, 64vh)" : "min(380px, 50vh)" }}
					title="Ambient Language Flashcards"
				/>
			</div>
		</div>
	)
}

export default AmbientLanguagePanel