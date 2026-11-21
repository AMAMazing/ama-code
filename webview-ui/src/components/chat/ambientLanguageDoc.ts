import ambientCoreAssets from "virtual:ambient-core"
import { SIDEBAR_OVERRIDE_CSS } from "./ambientLanguageStyles"

export type AmbientPersistedState = Record<string, unknown>

export const AUTO_OPEN_STORAGE_KEY = "amaCode.ambientLanguage.autoOpen"
export const EXPANDED_STORAGE_KEY = "amaCode.ambientLanguage.expanded"
export const AMBIENT_STATE_STORAGE_KEY = "ambientThai.v2"

const AMP = String.fromCharCode(38)
const DEFAULT_EMO_KNOWN = ["ม", "า", "น", "ก", "ี"]
const VALID_FONTS = new Set(["modern", "looped", "mix"])
const VALID_SOUNDS = new Set(["off", "dings", "voice"])
const GOOGLE_FONTS_URL =
	"https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Noto+Sans+Thai:wght@500;700&family=Noto+Sans+Thai+Looped:wght@500;700&display=swap"

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

function toSafeNonNegInt(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

export function sanitizeAmbientState(raw: unknown): AmbientPersistedState | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return null
	}
	const src = raw as Record<string, unknown>
	const emoKnown = Array.isArray(src.emoKnown)
		? [...new Set(src.emoKnown.filter((c): c is string => typeof c === "string" && c.length > 0))]
		: []
	const emoUnlocked = Array.isArray(src.emoUnlocked)
		? [
				...new Set(
					src.emoUnlocked.filter(
						(id): id is number => typeof id === "number" && Number.isInteger(id) && id >= 0,
					),
				),
			]
		: []

	const charLastSeen: Record<string, number> = {}
	if (src.charLastSeen && typeof src.charLastSeen === "object" && !Array.isArray(src.charLastSeen)) {
		for (const [k, v] of Object.entries(src.charLastSeen as Record<string, unknown>)) {
			if (k && typeof v === "number" && Number.isFinite(v) && v >= 0) {
				charLastSeen[k] = Math.floor(v)
			}
		}
	}

	const flaws: Record<string, number> = {}
	if (src.flaws && typeof src.flaws === "object" && !Array.isArray(src.flaws)) {
		for (const [k, v] of Object.entries(src.flaws as Record<string, unknown>)) {
			if (k && typeof v === "number" && Number.isFinite(v) && v > 0) {
				flaws[k] = Math.min(Math.floor(v), 9)
			}
		}
	}

	const rawSnd = src.snd
	const snd =
		typeof rawSnd === "string" && VALID_SOUNDS.has(rawSnd) ? rawSnd : rawSnd === false ? "off" : "dings"
	const rawLastFlawTurn = src.lastFlawTurn
	const lastFlawTurn =
		typeof rawLastFlawTurn === "number" && Number.isFinite(rawLastFlawTurn) && rawLastFlawTurn >= -1
			? Math.floor(rawLastFlawTurn)
			: -1

	return {
		i: toSafeNonNegInt(src.i, 0),
		n: toSafeNonNegInt(src.n, 0),
		m: "A",
		snd,
		f: typeof src.f === "string" && VALID_FONTS.has(src.f) ? src.f : "modern",
		phoneticsMode: src.phoneticsMode === "literal" ? "literal" : "real",
		clueMode: src.clueMode === "learn" ? "learn" : "mystery",
		emoKnown: emoKnown.length > 0 ? emoKnown : [...DEFAULT_EMO_KNOWN],
		emoUnlocked,
		charLastSeen,
		flaws,
		lastFlawTurn,
		emoTurn: toSafeNonNegInt(src.emoTurn, 0),
		updatedAt: toSafeNonNegInt(src.updatedAt, Date.now()),
	}
}

export function readMetaContent(name: string, fallback: string): string {
	if (typeof document === "undefined") {
		return fallback
	}
	const meta = document.querySelector(`meta[name="${name}"]`)
	return meta?.getAttribute("content") || fallback
}

export function readAutoOpenPreference(): boolean {
	if (cachedAutoOpen !== null) {
		return cachedAutoOpen
	}
	try {
		const stored = localStorage.getItem(AUTO_OPEN_STORAGE_KEY)
		return stored === null ? true : stored === "true"
	} catch {
		return true
	}
}

export function writeAutoOpenPreference(value: boolean): void {
	cachedAutoOpen = value
	try {
		localStorage.setItem(AUTO_OPEN_STORAGE_KEY, String(value))
	} catch {
		// Ignore storage errors
	}
}

export function readExpandedPreference(): boolean {
	if (cachedIsExpanded !== null) {
		return cachedIsExpanded
	}
	try {
		const stored = localStorage.getItem(EXPANDED_STORAGE_KEY)
		return stored === null ? false : stored === "true"
	} catch {
		return false
	}
}

export function writeExpandedPreference(value: boolean): void {
	cachedIsExpanded = value
	try {
		localStorage.setItem(EXPANDED_STORAGE_KEY, String(value))
	} catch {
		// Ignore storage errors
	}
}

export function loadSavedAmbientState(): AmbientPersistedState | null {
	if (cachedAmbientState) {
		const sanitized = sanitizeAmbientState(cachedAmbientState)
		if (sanitized) {
			cachedAmbientState = sanitized
			return { ...sanitized }
		}
		cachedAmbientState = null
	}
	try {
		const raw = localStorage.getItem(AMBIENT_STATE_STORAGE_KEY)
		if (!raw) {
			return null
		}
		const parsed = JSON.parse(raw)
		const sanitized = sanitizeAmbientState(parsed)
		if (sanitized) {
			cachedAmbientState = sanitized
			return { ...sanitized }
		}
		localStorage.removeItem(AMBIENT_STATE_STORAGE_KEY)
	} catch {
		try {
			localStorage.removeItem(AMBIENT_STATE_STORAGE_KEY)
		} catch {
			// Ignore storage cleanup errors
		}
	}
	return null
}

export function saveAmbientState(state: AmbientPersistedState): void {
	const sanitized = sanitizeAmbientState(state)
	if (!sanitized) {
		return
	}
	cachedAmbientState = sanitized
	try {
		const serialized = JSON.stringify(sanitized)
		if (localStorage.getItem(AMBIENT_STATE_STORAGE_KEY) !== serialized) {
			localStorage.setItem(AMBIENT_STATE_STORAGE_KEY, serialized)
		}
	} catch {
		// Ignore storage errors
	}
}

export function clearSavedAmbientState(): void {
	cachedAmbientState = null
	try {
		localStorage.removeItem(AMBIENT_STATE_STORAGE_KEY)
	} catch {
		// Ignore storage errors
	}
}

function buildPreBridgeScript(initialState: AmbientPersistedState | null, instanceId: number): string {
	const serializedInitialState = serializeInlineJson(initialState)
	return `(function () {
  window.__AMBIENT_INITIAL_STATE__ = ${serializedInitialState};
  window.__AMBIENT_BOOTING__ = true;
  window.__AMBIENT_INSTANCE_ID__ = ${instanceId};

  function reportError(msg) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "AMBIENT_ERROR",
          instanceId: window.__AMBIENT_INSTANCE_ID__,
          message: String(msg || "Unknown ambient runtime error")
        }, "*");
      }
    } catch (e) {}
  }

  window.addEventListener("error", function (event) {
    reportError(event && (event.message || (event.error && event.error.message)));
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    reportError(reason && reason.message ? reason.message : reason);
  });

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
            window.parent.postMessage(Object.assign({}, msg, { instanceId: window.__AMBIENT_INSTANCE_ID__ }), "*");
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

  function hasRenderedContent() {
    var stage = document.getElementById("stage");
    var kb = document.getElementById("kb");
    return Boolean(stage && stage.children.length > 0 && kb && kb.children.length > 0);
  }

  function notifyParent(payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(Object.assign({ instanceId: window.__AMBIENT_INSTANCE_ID__ }, payload), "*");
      }
    } catch (e) {}
  }

  if (!hasRenderedContent() && typeof render === "function") {
    try { render(); } catch (e) {}
  }

  if (hasRenderedContent()) {
    notifyParent({ type: "AMBIENT_READY" });
  } else {
    notifyParent({ type: "AMBIENT_ERROR", message: "Ambient stage rendered empty" });
  }

  window.addEventListener("message", function (event) {
    var data = event && event.data;
    if (!data || data.type !== "AMBIENT_PING") return;
    if (!hasRenderedContent() && typeof render === "function") {
      try { render(); } catch (e) {}
    }
    notifyParent({ type: "AMBIENT_PONG", hasContent: hasRenderedContent() });
  });

  // Load web fonts asynchronously after boot so offline/slow networks never blank the stage
  setTimeout(function () {
    try {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = ${JSON.stringify(GOOGLE_FONTS_URL)};
      document.head.appendChild(link);
    } catch (e) {}
  }, 50);
})();`

export function buildAmbientSrcDoc(
	nonce: string,
	initialState: AmbientPersistedState | null,
	instanceId: number,
): string {
	const nonceAttr = nonce ? ` nonce="${escapeAttr(nonce)}"` : ""
	const inlineCoreCss = escapeInlineStyle(ambientCoreAssets.styleCss)
	const inlineOverrideCss = escapeInlineStyle(SIDEBAR_OVERRIDE_CSS)

	const scripts = [
		buildPreBridgeScript(initialState, instanceId),
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