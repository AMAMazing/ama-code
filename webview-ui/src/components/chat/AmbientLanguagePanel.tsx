import { AlertTriangle, ChevronDown, ChevronUp, Maximize2, Minimize2, Pin, PinOff, RotateCw } from "lucide-react"
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

interface AmbientLanguagePanelProps {
	isAgentWaiting: boolean
}

type FrameStatus = "loading" | "ready" | "error"

const BOOT_TIMEOUT_MS = 3500
const PING_TIMEOUT_MS = 1800
const MAX_AUTO_RETRIES = 1

export const AmbientLanguagePanel: React.FC<AmbientLanguagePanelProps> = ({ isAgentWaiting }) => {
	const [autoOpen, setAutoOpen] = useState<boolean>(() => readAutoOpenPreference())
	const [isOpen, setIsOpen] = useState<boolean>(false)
	const [hasBooted, setHasBooted] = useState<boolean>(false)
	const [isPinned, setIsPinned] = useState<boolean>(false)
	const [isExpanded, setIsExpanded] = useState<boolean>(() => readExpandedPreference())
	const [reloadTick, setReloadTick] = useState<number>(0)
	const [frameStatus, setFrameStatus] = useState<FrameStatus>("loading")
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const wasWaitingRef = useRef<boolean>(false)
	const wasOpenRef = useRef<boolean>(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const reloadTickRef = useRef<number>(0)
	const autoRetryCountRef = useRef<number>(0)
	const pingTimerRef = useRef<number | null>(null)

	reloadTickRef.current = reloadTick

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

	useEffect(() => {
		const prevWaiting = wasWaitingRef.current
		wasWaitingRef.current = isAgentWaiting

		if (isAgentWaiting && !prevWaiting) {
			if (autoOpen) {
				setIsOpen(true)
				setHasBooted(true)
			}
		} else if (!isAgentWaiting && prevWaiting) {
			if (!isPinned) {
				setIsOpen(false)
			}
		}
	}, [isAgentWaiting, autoOpen, isPinned])

	useEffect(() => {
		if (isOpen && !hasBooted) {
			setHasBooted(true)
		}
	}, [isOpen, hasBooted])

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
		if (!hasBooted || !isOpen || frameStatus !== "loading") {
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
	}, [hasBooted, isOpen, frameStatus, reloadTick, triggerReload])

	useEffect(() => {
		const prevOpen = wasOpenRef.current
		wasOpenRef.current = isOpen

		if (!isOpen) {
			clearPingTimer()
			return
		}

		if (isOpen && !prevOpen && hasBooted && frameStatus === "ready") {
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
	}, [isOpen, hasBooted, frameStatus, clearPingTimer, triggerReload])

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
				setHasBooted(true)
			} else {
				setIsPinned(false)
			}
			return next
		})
	}, [])

	const srcDoc = useMemo(() => {
		if (!hasBooted) {
			return ""
		}
		const nonce = readMetaContent("csp-nonce", "")
		return buildAmbientSrcDoc(nonce, loadSavedAmbientState(), reloadTick)
	}, [hasBooted, reloadTick])

	if (!hasBooted && !isAgentWaiting && !isOpen) {
		return null
	}

	const iframeHeight = isExpanded ? "min(520px, 64vh)" : "min(380px, 50vh)"

	return (
		<>
			{!isOpen && isAgentWaiting && (
				<div className="px-2.5 pt-1.5">
					<button
						className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-[#252d39] bg-[#141922] text-[11px] text-[#9aa4b2] hover:text-[#e8ecf1] hover:border-[#5cc8ff]/50 transition-colors cursor-pointer"
						onClick={handleToggleOpen}
						title="Play Ambient Language flashcards while waiting for the agent"
						type="button">
						<span className="flex items-center gap-1.5 truncate">
							<span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
							<span className="truncate font-medium text-[#e8ecf1]">🌍 Ambient Language</span>
							<span className="text-[#7d8896] truncate">· Play while waiting</span>
						</span>
						<ChevronUp className="w-3.5 h-3.5 shrink-0" />
					</button>
				</div>
			)}

			{hasBooted && (
				<div className={isOpen ? "px-2.5 pt-1.5" : "hidden"}>
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
									onClick={() => triggerReload(true)}
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
						<div className="relative w-full bg-[#0d1015]" style={{ height: iframeHeight }}>
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
					</div>
				</div>
			)}
		</>
	)
}

export default AmbientLanguagePanel