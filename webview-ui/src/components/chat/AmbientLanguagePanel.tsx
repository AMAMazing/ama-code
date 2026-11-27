import {
	AlertTriangle,
	BookOpen,
	ChevronDown,
	ChevronUp,
	FileText,
	Maximize2,
	Minimize2,
	Pin,
	PinOff,
	RotateCw,
} from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	type AmbientPersistedState,
	buildAmbientSrcDoc,
	clearSavedAmbientState,
	loadSavedAmbientState,
	readAutoOpenPreference,
	readExpandedPreference,
	readMetaContent,
	saveAmbientState,
	writeAutoOpenPreference,
	writeExpandedPreference,
} from "./ambientLanguageDoc"
import WaitingNotesPanel from "./WaitingNotesPanel"
import {
	readWaitingPanelMode,
	WAITING_MODE_STORAGE_KEY,
	type WaitingPanelMode,
	writeWaitingPanelMode,
} from "./waitingNotesStore"

interface AmbientLanguagePanelProps {
	isAgentWaiting: boolean
}

type FrameStatus = "loading" | "ready" | "error"

const BOOT_TIMEOUT_MS = 3500
const PING_TIMEOUT_MS = 1800
const MAX_AUTO_RETRIES = 1

export const AmbientLanguagePanel: React.FC<AmbientLanguagePanelProps> = ({ isAgentWaiting }) => {
	const [panelMode, setPanelMode] = useState<WaitingPanelMode>(() => readWaitingPanelMode())
	const [autoOpen, setAutoOpen] = useState<boolean>(() => readAutoOpenPreference())
	const [isOpen, setIsOpen] = useState<boolean>(false)
	const [hasOpenedPanel, setHasOpenedPanel] = useState<boolean>(false)
	const [hasBootedAmbient, setHasBootedAmbient] = useState<boolean>(false)
	const [hasOpenedNotes, setHasOpenedNotes] = useState<boolean>(false)
	const [isPinned, setIsPinned] = useState<boolean>(false)
	const [isExpanded, setIsExpanded] = useState<boolean>(() => readExpandedPreference())
	const [reloadTick, setReloadTick] = useState<number>(0)
	const [frameStatus, setFrameStatus] = useState<FrameStatus>("loading")
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const wasWaitingRef = useRef<boolean>(false)
	const wasAmbientVisibleRef = useRef<boolean>(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const reloadTickRef = useRef<number>(0)
	const autoRetryCountRef = useRef<number>(0)
	const pingTimerRef = useRef<number | null>(null)

	reloadTickRef.current = reloadTick

	const isAmbientVisible = isOpen && panelMode === "ambient"

	const clearPingTimer = useCallback(() => {
		if (pingTimerRef.current !== null) {
			window.clearTimeout(pingTimerRef.current)
			pingTimerRef.current = null
		}
	}, [])

	const triggerReload = useCallback(
		(resetRetries = true) => {
			clearPingTimer()
			if (resetRetries) {
				autoRetryCountRef.current = 0
			}
			setErrorMessage(null)
			setFrameStatus("loading")
			setReloadTick((t) => t + 1)
		},
		[clearPingTimer],
	)

	const handleResetAndReload = useCallback(() => {
		clearSavedAmbientState()
		triggerReload(true)
	}, [triggerReload])

	const handleSelectMode = useCallback((nextMode: WaitingPanelMode) => {
		setPanelMode(nextMode)
		writeWaitingPanelMode(nextMode)
		if (nextMode === "ambient") {
			setHasBootedAmbient(true)
		} else {
			setHasOpenedNotes(true)
		}
	}, [])

	const openPanelWithMode = useCallback((targetMode: WaitingPanelMode) => {
		setPanelMode(targetMode)
		writeWaitingPanelMode(targetMode)
		setIsOpen(true)
		setHasOpenedPanel(true)
		if (targetMode === "ambient") {
			setHasBootedAmbient(true)
		} else {
			setHasOpenedNotes(true)
		}
	}, [])

	// Sync preferred waiting mode across open VS Code projects/windows
	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key === WAITING_MODE_STORAGE_KEY && (event.newValue === "ambient" || event.newValue === "notes")) {
				setPanelMode(event.newValue)
			}
		}
		window.addEventListener("storage", handleStorage)
		return () => {
			window.removeEventListener("storage", handleStorage)
		}
	}, [])

	useEffect(() => {
		const prevWaiting = wasWaitingRef.current
		wasWaitingRef.current = isAgentWaiting

		if (isAgentWaiting && !prevWaiting) {
			if (autoOpen) {
				setIsOpen(true)
				setHasOpenedPanel(true)
				if (panelMode === "ambient") {
					setHasBootedAmbient(true)
				} else {
					setHasOpenedNotes(true)
				}
			}
		} else if (!isAgentWaiting && prevWaiting) {
			if (!isPinned) {
				setIsOpen(false)
			}
		}
	}, [isAgentWaiting, autoOpen, isPinned, panelMode])

	useEffect(() => {
		if (!isOpen) {
			return
		}
		if (!hasOpenedPanel) {
			setHasOpenedPanel(true)
		}
		if (panelMode === "ambient" && !hasBootedAmbient) {
			setHasBootedAmbient(true)
		} else if (panelMode === "notes" && !hasOpenedNotes) {
			setHasOpenedNotes(true)
		}
	}, [isOpen, panelMode, hasOpenedPanel, hasBootedAmbient, hasOpenedNotes])

	useEffect(() => {
		const handleIframeMessage = (event: MessageEvent) => {
			if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
				return
			}
			const data = event.data
			if (!data || typeof data !== "object") {
				return
			}
			if (typeof data.instanceId === "number" && data.instanceId !== reloadTickRef.current) {
				return
			}

			if (data.type === "AMBIENT_SAVE_STATE" && data.state && typeof data.state === "object") {
				saveAmbientState(data.state as AmbientPersistedState)
				return
			}

			if (data.type === "AMBIENT_READY") {
				clearPingTimer()
				autoRetryCountRef.current = 0
				setErrorMessage(null)
				setFrameStatus("ready")
				return
			}

			if (data.type === "AMBIENT_PONG") {
				clearPingTimer()
				if (data.hasContent === false) {
					if (autoRetryCountRef.current < MAX_AUTO_RETRIES) {
						autoRetryCountRef.current += 1
						triggerReload(false)
					} else {
						setErrorMessage("Ambient flashcards rendered blank.")
						setFrameStatus("error")
					}
				} else {
					setErrorMessage(null)
					setFrameStatus("ready")
				}
				return
			}

			if (data.type === "AMBIENT_ERROR") {
				clearPingTimer()
				const msg = typeof data.message === "string" && data.message.trim() ? data.message : "Flashcards encountered an error."
				if (autoRetryCountRef.current < MAX_AUTO_RETRIES) {
					autoRetryCountRef.current += 1
					triggerReload(false)
				} else {
					setErrorMessage(msg)
					setFrameStatus("error")
				}
			}
		}

		window.addEventListener("message", handleIframeMessage)
		return () => {
			window.removeEventListener("message", handleIframeMessage)
		}
	}, [clearPingTimer, triggerReload])

	useEffect(() => {
		if (!hasBootedAmbient || !isAmbientVisible || frameStatus !== "loading") {
			return
		}
		const bootTimer = window.setTimeout(() => {
			if (autoRetryCountRef.current < MAX_AUTO_RETRIES) {
				autoRetryCountRef.current += 1
				triggerReload(false)
			} else {
				setErrorMessage("Flashcards took too long to initialize.")
				setFrameStatus("error")
			}
		}, BOOT_TIMEOUT_MS)

		return () => {
			window.clearTimeout(bootTimer)
		}
	}, [hasBootedAmbient, isAmbientVisible, frameStatus, reloadTick, triggerReload])

	useEffect(() => {
		const prevVisible = wasAmbientVisibleRef.current
		wasAmbientVisibleRef.current = isAmbientVisible

		if (!isAmbientVisible) {
			clearPingTimer()
			return
		}

		if (isAmbientVisible && !prevVisible && hasBootedAmbient && frameStatus === "ready") {
			clearPingTimer()
			try {
				iframeRef.current?.contentWindow?.postMessage({ type: "AMBIENT_PING" }, "*")
			} catch {
				triggerReload(false)
				return
			}
			pingTimerRef.current = window.setTimeout(() => {
				pingTimerRef.current = null
				triggerReload(false)
			}, PING_TIMEOUT_MS)
		}
	}, [isAmbientVisible, hasBootedAmbient, frameStatus, clearPingTimer, triggerReload])

	useEffect(() => {
		return () => {
			clearPingTimer()
		}
	}, [clearPingTimer])

	const toggleAutoOpen = useCallback(() => {
		setAutoOpen((prev) => {
			const next = !prev
			writeAutoOpenPreference(next)
			return next
		})
	}, [])

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => {
			const next = !prev
			writeExpandedPreference(next)
			return next
		})
	}, [])

	const handleToggleOpen = useCallback(() => {
		setIsOpen((prev) => {
			const next = !prev
			if (next) {
				setHasOpenedPanel(true)
				if (panelMode === "ambient") {
					setHasBootedAmbient(true)
				} else {
					setHasOpenedNotes(true)
				}
			} else {
				setIsPinned(false)
			}
			return next
		})
	}, [panelMode])

	const srcDoc = useMemo(() => {
		if (!hasBootedAmbient) {
			return ""
		}
		const nonce = readMetaContent("csp-nonce", "")
		return buildAmbientSrcDoc(nonce, loadSavedAmbientState(), reloadTick)
	}, [hasBootedAmbient, reloadTick])

	if (!hasOpenedPanel && !isAgentWaiting && !isOpen) {
		return null
	}

	const panelHeight = isExpanded ? "min(520px, 64vh)" : "min(380px, 50vh)"

	return (
		<>
			{!isOpen && isAgentWaiting && (
				<div className="px-2.5 pt-1.5">
					<div className="w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg border border-[#252d39] bg-[#141922] text-[11px] text-[#9aa4b2]">
						<button
							className="flex flex-1 items-center gap-1.5 min-w-0 text-left hover:text-[#e8ecf1] transition-colors cursor-pointer bg-transparent border-0 p-0.5"
							onClick={handleToggleOpen}
							title={
								panelMode === "notes"
									? "Open Notes while waiting for the agent"
									: "Play Ambient Language flashcards while waiting for the agent"
							}
							type="button">
							<span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
							<span className="truncate font-medium text-[#e8ecf1]">
								{panelMode === "notes" ? "Notes" : "Ambient Language"}
							</span>
							<span className="text-[#7d8896] truncate">
								· {panelMode === "notes" ? "Jot while waiting" : "Play while waiting"}
							</span>
						</button>
						<div className="flex items-center gap-1 shrink-0">
							<div className="flex items-center rounded-md bg-[#0d1015] border border-[#222a36] p-0.5">
								<button
									className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
										panelMode === "ambient"
											? "bg-[#1a2230] text-[#5cc8ff] font-medium"
											: "text-[#7d8896] hover:text-[#e8ecf1]"
									}`}
									onClick={() => openPanelWithMode("ambient")}
									title="Open Ambient Learning"
									type="button">
									<BookOpen className="w-2.5 h-2.5" />
									<span>Learn</span>
								</button>
								<button
									className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
										panelMode === "notes"
											? "bg-[#1a2230] text-[#5cc8ff] font-medium"
											: "text-[#7d8896] hover:text-[#e8ecf1]"
									}`}
									onClick={() => openPanelWithMode("notes")}
									title="Open Notes"
									type="button">
									<FileText className="w-2.5 h-2.5" />
									<span>Notes</span>
								</button>
							</div>
							<button
								className="p-0.5 rounded text-[#7d8896] hover:text-[#e8ecf1] hover:bg-[#1f2630] transition-colors cursor-pointer"
								onClick={handleToggleOpen}
								title="Expand panel"
								type="button">
								<ChevronUp className="w-3.5 h-3.5 shrink-0" />
							</button>
						</div>
					</div>
				</div>
			)}

			{hasOpenedPanel && (
				<div className={isOpen ? "px-2.5 pt-1.5" : "hidden"}>
					<div className="rounded-lg overflow-hidden border border-[#252d39] bg-[#0d1015] shadow-lg flex flex-col">
						<div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-[#141922] border-b border-[#252d39] text-[11px] text-[#9aa4b2] select-none">
							<div className="flex items-center gap-1.5 min-w-0">
								<span
									className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
										isAgentWaiting ? "bg-sky-400 animate-pulse" : "bg-emerald-400"
									}`}
									title={isAgentWaiting ? "Waiting on agent" : "Agent ready"}
								/>
								<div className="flex items-center rounded-md bg-[#0d1015] border border-[#222a36] p-0.5 shrink-0">
									<button
										className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
											panelMode === "ambient"
												? "bg-[#1a2230] text-[#e8ecf1] font-medium"
												: "text-[#7d8896] hover:text-[#cbd5e1]"
										}`}
										onClick={() => handleSelectMode("ambient")}
										title="Switch to Ambient Learning"
										type="button">
										<BookOpen className="w-2.5 h-2.5" />
										<span>Learn</span>
									</button>
									<button
										className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
											panelMode === "notes"
												? "bg-[#1a2230] text-[#5cc8ff] font-medium"
												: "text-[#7d8896] hover:text-[#cbd5e1]"
										}`}
										onClick={() => handleSelectMode("notes")}
										title="Switch to Notes (saved locally across all projects)"
										type="button">
										<FileText className="w-2.5 h-2.5" />
										<span>Notes</span>
									</button>
								</div>
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
								{panelMode === "ambient" && (
									<button
										className="p-1 rounded hover:bg-[#1f2630] text-[#7d8896] hover:text-[#e8ecf1] cursor-pointer transition-colors"
										onClick={() => triggerReload(true)}
										title="Reload flashcards"
										type="button">
										<RotateCw className="w-3 h-3" />
									</button>
								)}
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
									title={panelMode === "notes" ? "Minimize notes" : "Minimize flashcards"}
									type="button">
									<ChevronDown className="w-3.5 h-3.5" />
								</button>
							</div>
						</div>
						<div className="relative w-full bg-[#0d1015]" style={{ height: panelHeight }}>
							{hasBootedAmbient && (
								<div className={panelMode === "ambient" ? "relative w-full h-full bg-[#0d1015]" : "hidden"}>
									<iframe
										className="w-full h-full border-0 block bg-[#0d1015]"
										key={reloadTick}
										ref={iframeRef}
										srcDoc={srcDoc}
										title="Ambient Language Flashcards"
									/>
									{frameStatus === "error" && (
										<div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center bg-[#0d1015]/95 text-[#e8ecf1]">
											<AlertTriangle className="w-5 h-5 text-amber-400" />
											<div className="text-xs font-medium">Ambient Learning hit a snag</div>
											{errorMessage && (
												<div className="text-[11px] text-[#9aa4b2] max-w-[260px] break-words">
													{errorMessage}
												</div>
											)}
											<div className="flex items-center gap-2 pt-1">
												<button
													className="px-2.5 py-1 rounded-md border border-[#5cc8ff]/50 bg-[#162230] text-[#5cc8ff] text-[11px] hover:bg-[#1c3248] cursor-pointer transition-colors"
													onClick={() => triggerReload(true)}
													type="button">
													Reload
												</button>
												<button
													className="px-2.5 py-1 rounded-md border border-[#252d39] bg-[#141922] text-[#9aa4b2] text-[11px] hover:text-[#e8ecf1] hover:border-[#5cc8ff]/40 cursor-pointer transition-colors"
													onClick={handleResetAndReload}
													type="button">
													Reset & Reload
												</button>
											</div>
										</div>
									)}
								</div>
							)}
							{hasOpenedNotes && (
								<div className={panelMode === "notes" ? "w-full h-full" : "hidden"}>
									<WaitingNotesPanel />
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	)
}

export default AmbientLanguagePanel