export type WaitingPanelMode = "ambient" | "notes"

export interface WaitingNote {
	id: string
	title: string
	content: string
	createdAt: number
	updatedAt: number
}

export interface WaitingNotesState {
	notes: WaitingNote[]
	activeNoteId: string
}

export const WAITING_MODE_STORAGE_KEY = "ama-code.waiting-panel-mode.v1"
export const WAITING_NOTES_STORAGE_KEY = "ama-code.waiting-notes.v1"

function generateNoteId(): string {
	try {
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
			return crypto.randomUUID()
		}
	} catch {
		// Fallback below
	}
	return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createWaitingNote(title = "", content = ""): WaitingNote {
	const now = Date.now()
	return {
		id: generateNoteId(),
		title,
		content,
		createdAt: now,
		updatedAt: now,
	}
}

export function createDefaultNotesState(): WaitingNotesState {
	const starter = createWaitingNote("Scratchpad", "")
	return {
		notes: [starter],
		activeNoteId: starter.id,
	}
}

function isValidNote(value: unknown): value is WaitingNote {
	if (!value || typeof value !== "object") {
		return false
	}
	const candidate = value as Partial<WaitingNote>
	return (
		typeof candidate.id === "string" &&
		candidate.id.length > 0 &&
		typeof candidate.title === "string" &&
		typeof candidate.content === "string" &&
		typeof candidate.createdAt === "number" &&
		typeof candidate.updatedAt === "number"
	)
}

export function parseWaitingNotesState(raw: string | null): WaitingNotesState | null {
	if (!raw) {
		return null
	}
	try {
		const parsed = JSON.parse(raw) as Partial<WaitingNotesState> | null
		if (!parsed || !Array.isArray(parsed.notes)) {
			return null
		}
		const validNotes = parsed.notes.filter(isValidNote)
		if (validNotes.length === 0) {
			return null
		}
		const activeNoteId =
			typeof parsed.activeNoteId === "string" && validNotes.some((n) => n.id === parsed.activeNoteId)
				? parsed.activeNoteId
				: validNotes[0].id
		return {
			notes: validNotes,
			activeNoteId,
		}
	} catch {
		return null
	}
}

export function loadWaitingNotesState(): WaitingNotesState {
	try {
		const raw = window.localStorage.getItem(WAITING_NOTES_STORAGE_KEY)
		const parsed = parseWaitingNotesState(raw)
		if (parsed) {
			return parsed
		}
	} catch {
		// Ignore storage access errors
	}
	return createDefaultNotesState()
}

export function saveWaitingNotesState(state: WaitingNotesState): void {
	try {
		window.localStorage.setItem(WAITING_NOTES_STORAGE_KEY, JSON.stringify(state))
	} catch {
		// Ignore quota or storage access errors
	}
}

export function getLatestNoteTimestamp(state: WaitingNotesState): number {
	return state.notes.reduce((maxTs, note) => Math.max(maxTs, note.updatedAt), 0)
}

export function readWaitingPanelMode(): WaitingPanelMode {
	try {
		const raw = window.localStorage.getItem(WAITING_MODE_STORAGE_KEY)
		if (raw === "notes" || raw === "ambient") {
			return raw
		}
	} catch {
		// Ignore storage errors
	}
	return "ambient"
}

export function writeWaitingPanelMode(mode: WaitingPanelMode): void {
	try {
		window.localStorage.setItem(WAITING_MODE_STORAGE_KEY, mode)
	} catch {
		// Ignore storage errors
	}
}

export function countWords(text: string): number {
	const trimmed = text.trim()
	if (!trimmed) {
		return 0
	}
	return trimmed.split(/\s+/).length
}

export function getNotePreviewLine(content: string): string {
	const firstLine = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0)
	if (!firstLine) {
		return "Empty note"
	}
	return firstLine
		.replace(/^#{1,6}\s+/, "")
		.replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
		.replace(/^[-*+]\s+/, "")
		.replace(/^>\s+/, "")
		.slice(0, 80)
}

export function formatRelativeTime(timestamp: number): string {
	const diffMs = Math.max(0, Date.now() - timestamp)
	const seconds = Math.floor(diffMs / 1000)
	if (seconds < 45) {
		return "just now"
	}
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) {
		return `${minutes}m ago`
	}
	const hours = Math.floor(minutes / 60)
	if (hours < 24) {
		return `${hours}h ago`
	}
	const days = Math.floor(hours / 24)
	if (days < 7) {
		return `${days}d ago`
	}
	try {
		return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })
	} catch {
		return ""
	}
}