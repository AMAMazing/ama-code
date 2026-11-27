import type { ManualModeState } from "@shared/ExtensionMessage"
import { AlertCircle, Check, Clipboard, ClipboardPaste, X } from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { PLATFORM_CONFIG } from "@/config/platform.config"

const INITIAL_MANUAL_STATE: ManualModeState = {
	waiting: false,
	hasPrompt: false,
	version: 0,
	queuedTools: 0,
}

const SECONDARY_BUTTON_BORDER_STYLE: React.CSSProperties = {
	borderColor: "var(--vscode-button-border, color-mix(in srgb, var(--vscode-foreground) 14%, transparent))",
}

const CARD_CONTAINER_STYLE: React.CSSProperties = {
	backgroundColor: "color-mix(in srgb, var(--vscode-editor-background) 55%, var(--vscode-sideBar-background))",
	borderColor: "color-mix(in srgb, var(--vscode-foreground) 12%, transparent)",
}

const ERROR_BANNER_STYLE: React.CSSProperties = {
	backgroundColor: "color-mix(in srgb, var(--vscode-errorForeground) 10%, transparent)",
	borderColor: "color-mix(in srgb, var(--vscode-errorForeground) 28%, transparent)",
}

export function useManualModeState(isManualMode: boolean) {
	const [state, setState] = useState<ManualModeState>(INITIAL_MANUAL_STATE)
	const [justCopied, setJustCopied] = useState(false)
	const copyTimerRef = useRef<number | null>(null)

	useEffect(() => {
		if (!isManualMode) {
			setState(INITIAL_MANUAL_STATE)
			setJustCopied(false)
			return
		}

		const handleMessage = (event: MessageEvent) => {
			const msg = event.data
			if (msg && msg.type === "manual_mode_state" && msg.manualModeState) {
				setState(msg.manualModeState as ManualModeState)
			}
		}

		window.addEventListener("message", handleMessage)
		PLATFORM_CONFIG.postMessage({ type: "manual_get_state" })

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [isManualMode])

	useEffect(() => {
		return () => {
			if (copyTimerRef.current !== null) {
				window.clearTimeout(copyTimerRef.current)
			}
		}
	}, [])

	const copyPrompt = useCallback(() => {
		PLATFORM_CONFIG.postMessage({ type: "manual_copy_prompt" })
		setJustCopied(true)
		if (copyTimerRef.current !== null) {
			window.clearTimeout(copyTimerRef.current)
		}
		copyTimerRef.current = window.setTimeout(() => {
			setJustCopied(false)
			copyTimerRef.current = null
		}, 1600)
	}, [])

	const pasteResponse = useCallback(() => {
		PLATFORM_CONFIG.postMessage({ type: "manual_paste_response" })
	}, [])

	return {
		state,
		justCopied,
		copyPrompt,
		pasteResponse,
	}
}

interface CopyPromptButtonProps {
	justCopied: boolean
	onCopyPrompt: () => void
}

const CopyPromptButton: React.FC<CopyPromptButtonProps> = ({ justCopied, onCopyPrompt }) => {
	return (
		<button
			className="flex-1 min-w-0 h-[30px] px-3 rounded-[4px] border inline-flex items-center justify-center gap-1.5 bg-button-secondary-background hover:bg-button-secondary-background-hover text-button-secondary-foreground text-[12.5px] font-medium leading-none whitespace-nowrap overflow-hidden cursor-pointer select-none transition-colors active:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--vscode-focusBorder)"
			onClick={onCopyPrompt}
			style={SECONDARY_BUTTON_BORDER_STYLE}
			type="button">
			{justCopied ? (
				<Check className="shrink-0 text-success" size={14} />
			) : (
				<Clipboard className="shrink-0 opacity-90" size={14} />
			)}
			<span className="truncate leading-none">
				{justCopied ? "Copied Prompt to Clipboard" : "Copy Prompt to Clipboard"}
			</span>
		</button>
	)
}

interface ManualModeCopyBarProps {
	justCopied: boolean
	queuedTools: number
	onCopyPrompt: () => void
}

export const ManualModeCopyBar: React.FC<ManualModeCopyBarProps> = ({ justCopied, queuedTools, onCopyPrompt }) => {
	return (
		<div className="px-3.5 pt-2 pb-1.5 flex items-center justify-between gap-2">
			<CopyPromptButton justCopied={justCopied} onCopyPrompt={onCopyPrompt} />
			{queuedTools > 0 && (
				<span className="text-[11px] leading-none px-1.5 py-1 rounded-[3px] bg-badge-background text-badge-foreground shrink-0">
					Queued: {queuedTools}
				</span>
			)}
		</div>
	)
}

interface ManualModePasteInputProps {
	error?: string
	hasPrompt?: boolean
	justCopied?: boolean
	queuedTools?: number
	onCopyPrompt?: () => void
	onPasteResponse: () => void
	onCancel: () => void
}

export const ManualModePasteInput: React.FC<ManualModePasteInputProps> = ({
	error,
	hasPrompt,
	justCopied = false,
	queuedTools = 0,
	onCopyPrompt,
	onPasteResponse,
	onCancel,
}) => {
	return (
		<div className="px-3.5 pt-2 pb-3">
			<div className="rounded-[6px] border p-2 flex flex-col gap-2" style={CARD_CONTAINER_STYLE}>
				<div className="flex items-center justify-between gap-2 px-0.5">
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="w-1.5 h-1.5 rounded-full bg-(--vscode-focusBorder) shrink-0" />
						<span className="text-[11px] font-medium leading-none text-(--vscode-descriptionForeground) truncate">
							Manual Mode · Waiting for response
						</span>
					</div>
					{queuedTools > 0 && (
						<span className="text-[10.5px] leading-none px-1.5 py-0.5 rounded-[3px] bg-badge-background text-badge-foreground shrink-0">
							Queued: {queuedTools}
						</span>
					)}
				</div>

				{hasPrompt && onCopyPrompt && (
					<div className="flex items-center gap-2">
						<CopyPromptButton justCopied={justCopied} onCopyPrompt={onCopyPrompt} />
					</div>
				)}

				{error && (
					<div
						className="flex items-start gap-1.5 rounded-[4px] border px-2 py-1.5 text-[11.5px] text-(--vscode-errorForeground) leading-snug"
						style={ERROR_BANNER_STYLE}>
						<AlertCircle className="shrink-0 mt-0.5" size={13} />
						<span className="min-w-0 break-words leading-snug">{error}</span>
					</div>
				)}

				<div className="flex items-center gap-2">
					<button
						className="flex-1 min-w-0 h-[32px] px-3 rounded-[4px] border border-transparent inline-flex items-center justify-center gap-1.5 bg-button-background hover:bg-button-hover text-button-foreground text-[12.5px] font-medium leading-none whitespace-nowrap overflow-hidden cursor-pointer select-none transition-colors active:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--vscode-focusBorder)"
						onClick={onPasteResponse}
						type="button">
						<ClipboardPaste className="shrink-0" size={14} />
						<span className="truncate leading-none">Paste Response</span>
					</button>
					<button
						className="shrink-0 h-[32px] px-2.5 rounded-[4px] border inline-flex items-center justify-center gap-1 bg-button-secondary-background hover:bg-button-secondary-background-hover text-button-secondary-foreground text-[12.5px] font-medium leading-none whitespace-nowrap cursor-pointer select-none transition-colors active:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--vscode-focusBorder)"
						onClick={onCancel}
						style={SECONDARY_BUTTON_BORDER_STYLE}
						type="button">
						<X className="shrink-0" size={14} />
						<span className="leading-none">Cancel</span>
					</button>
				</div>
			</div>
		</div>
	)
}