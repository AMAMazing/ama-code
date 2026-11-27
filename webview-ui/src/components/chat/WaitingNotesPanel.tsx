import {
	Bold,
	Check,
	CheckSquare,
	Code,
	Copy,
	Eye,
	Heading2,
	Italic,
	List,
	PanelLeft,
	PenLine,
	Plus,
	Search,
	Trash2,
	X,
} from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import {
	countWords,
	createWaitingNote,
	formatRelativeTime,
	getLatestNoteTimestamp,
	getNotePreviewLine,
	loadWaitingNotesState,
	parseWaitingNotesState,
	saveWaitingNotesState,
	WAITING_NOTES_STORAGE_KEY,
	type WaitingNote,
	type WaitingNotesState,
} from "./waitingNotesStore"

type EditorViewMode = "edit" | "preview"

export const WaitingNotesPanel: React.FC = () => {
	const [notesState, setNotesState] = useState<WaitingNotesState>(() => loadWaitingNotesState())
	const [viewMode, setViewMode] = useState<EditorViewMode>("edit")
	const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)
	const [searchQuery, setSearchQuery] = useState<string>("")
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
	const [copied, setCopied] = useState<boolean>(false)

	const titleInputRef = useRef<HTMLInputElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const notesStateRef = useRef<WaitingNotesState>(notesState)
	const copyTimerRef = useRef<number | null>(null)

	notesStateRef.current = notesState

	const activeNote: WaitingNote = useMemo(() => {
		return notesState.notes.find((n) => n.id === notesState.activeNoteId) ?? notesState.notes[0]
	}, [notesState])

	const updateState = useCallback((updater: (prev: WaitingNotesState) => WaitingNotesState) => {
		setNotesState((prev) => {
			const next = updater(prev)
			saveWaitingNotesState(next)
			return next
		})
	}, [])

	// Sync global notes across multiple open VS Code projects/windows
	useEffect(() => {
		const syncFromStorage = (raw?: string | null) => {
			const parsed = raw !== undefined ? parseWaitingNotesState(raw) : loadWaitingNotesState()
			if (!parsed) {
				return
			}
			const incomingLatest = getLatestNoteTimestamp(parsed)
			const currentLatest = getLatestNoteTimestamp(notesStateRef.current)
			const noteCountChanged = parsed.notes.length !== notesStateRef.current.notes.length
			if (incomingLatest > currentLatest || noteCountChanged) {
				setNotesState((prev) => {
					const keepActiveId = parsed.notes.some((n) => n.id === prev.activeNoteId)
						? prev.activeNoteId
						: parsed.activeNoteId
					return {
						notes: parsed.notes,
						activeNoteId: keepActiveId,
					}
				})
			}
		}

		const handleStorage = (event: StorageEvent) => {
			if (event.key === WAITING_NOTES_STORAGE_KEY) {
				syncFromStorage(event.newValue)
			}
		}

		const handleFocus = () => {
			syncFromStorage()
		}

		const handleVisibility = () => {
			if (document.visibilityState === "visible") {
				syncFromStorage()
			}
		}

		window.addEventListener("storage", handleStorage)
		window.addEventListener("focus", handleFocus)
		document.addEventListener("visibilitychange", handleVisibility)
		return () => {
			window.removeEventListener("storage", handleStorage)
			window.removeEventListener("focus", handleFocus)
			document.removeEventListener("visibilitychange", handleVisibility)
		}
	}, [])

	useEffect(() => {
		return () => {
			if (copyTimerRef.current !== null) {
				window.clearTimeout(copyTimerRef.current)
			}
		}
	}, [])

	const handleSelectNote = useCallback(
		(noteId: string) => {
			setConfirmDeleteId(null)
			setIsDrawerOpen(false)
			updateState((prev) => ({
				...prev,
				activeNoteId: noteId,
			}))
		},
		[updateState],
	)

	const handleCreateNote = useCallback(() => {
		const fresh = createWaitingNote("", "")
		setConfirmDeleteId(null)
		setIsDrawerOpen(false)
		setViewMode("edit")
		updateState((prev) => ({
			notes: [fresh, ...prev.notes],
			activeNoteId: fresh.id,
		}))
		window.setTimeout(() => {
			titleInputRef.current?.focus()
		}, 10)
	}, [updateState])

	const handleUpdateActiveNote = useCallback(
		(patch: Partial<Pick<WaitingNote, "title" | "content">>) => {
			const now = Date.now()
			updateState((prev) => ({
				...prev,
				notes: prev.notes.map((note) => (note.id === prev.activeNoteId ? { ...note, ...patch, updatedAt: now } : note)),
			}))
		},
		[updateState],
	)

	const performDeleteNote = useCallback(
		(noteId: string) => {
			setConfirmDeleteId(null)
			updateState((prev) => {
				const remaining = prev.notes.filter((note) => note.id !== noteId)
				if (remaining.length === 0) {
					const fallback = createWaitingNote("Scratchpad", "")
					return {
						notes: [fallback],
						activeNoteId: fallback.id,
					}
				}
				const nextActiveId = prev.activeNoteId === noteId ? remaining[0].id : prev.activeNoteId
				return {
					notes: remaining,
					activeNoteId: nextActiveId,
				}
			})
		},
		[updateState],
	)

	const handleRequestDelete = useCallback(
		(note: WaitingNote) => {
			const isEmpty = !note.title.trim() && !note.content.trim()
			if (isEmpty || confirmDeleteId === note.id) {
				performDeleteNote(note.id)
				return
			}
			setConfirmDeleteId(note.id)
		},
		[confirmDeleteId, performDeleteNote],
	)

	const handleCopyMarkdown = useCallback(() => {
		const fullText = activeNote.title.trim()
			? `# ${activeNote.title.trim()}\n\n${activeNote.content}`
			: activeNote.content
		if (!fullText.trim()) {
			return
		}
		navigator.clipboard?.writeText(fullText).catch(() => {
			// Ignore clipboard failures in restricted environments
		})
		setCopied(true)
		if (copyTimerRef.current !== null) {
			window.clearTimeout(copyTimerRef.current)
		}
		copyTimerRef.current = window.setTimeout(() => {
			setCopied(false)
			copyTimerRef.current = null
		}, 1400)
	}, [activeNote.content, activeNote.title])

	const applyInlineWrap = useCallback(
		(before: string, after: string, placeholder: string) => {
			const el = textareaRef.current
			if (!el) {
				handleUpdateActiveNote({ content: `${activeNote.content}${before}${placeholder}${after}` })
				return
			}
			const start = el.selectionStart
			const end = el.selectionEnd
			const value = activeNote.content
			const selected = value.slice(start, end)
			const inner = selected || placeholder
			const next = `${value.slice(0, start)}${before}${inner}${after}${value.slice(end)}`
			handleUpdateActiveNote({ content: next })
			window.requestAnimationFrame(() => {
				el.focus()
				const selStart = start + before.length
				el.setSelectionRange(selStart, selStart + inner.length)
			})
		},
		[activeNote.content, handleUpdateActiveNote],
	)

	const applyLinePrefix = useCallback(
		(prefix: string) => {
			const el = textareaRef.current
			if (!el) {
				handleUpdateActiveNote({ content: `${activeNote.content ? `${activeNote.content}\n` : ""}${prefix}` })
				return
			}
			const start = el.selectionStart
			const value = activeNote.content
			const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
			const lineEndIdx = value.indexOf("\n", start)
			const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
			const currentLine = value.slice(lineStart, lineEnd)
			const hasPrefix = currentLine.startsWith(prefix)
			const updatedLine = hasPrefix ? currentLine.slice(prefix.length) : `${prefix}${currentLine}`
			const next = `${value.slice(0, lineStart)}${updatedLine}${value.slice(lineEnd)}`
			const cursorOffset = hasPrefix ? -prefix.length : prefix.length
			handleUpdateActiveNote({ content: next })
			window.requestAnimationFrame(() => {
				el.focus()
				const nextPos = Math.max(lineStart, start + cursorOffset)
				el.setSelectionRange(nextPos, nextPos)
			})
		},
		[activeNote.content, handleUpdateActiveNote],
	)

	const handleEditorKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			const el = e.currentTarget
			const isMod = e.metaKey || e.ctrlKey

			if (isMod && e.key.toLowerCase() === "b") {
				e.preventDefault()
				applyInlineWrap("**", "**", "bold")
				return
			}
			if (isMod && e.key.toLowerCase() === "i") {
				e.preventDefault()
				applyInlineWrap("*", "*", "italic")
				return
			}
			if (isMod && e.key.toLowerCase() === "e") {
				e.preventDefault()
				setViewMode((prev) => (prev === "edit" ? "preview" : "edit"))
				return
			}

			if (e.key === "Tab") {
				e.preventDefault()
				const start = el.selectionStart
				const end = el.selectionEnd
				const value = activeNote.content
				const next = `${value.slice(0, start)}  ${value.slice(end)}`
				handleUpdateActiveNote({ content: next })
				window.requestAnimationFrame(() => {
					el.setSelectionRange(start + 2, start + 2)
				})
				return
			}

			if (e.key === "Enter" && !e.shiftKey && !isMod) {
				const start = el.selectionStart
				const end = el.selectionEnd
				if (start !== end) {
					return
				}
				const value = activeNote.content
				const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
				const lineBeforeCursor = value.slice(lineStart, start)

				const taskMatch = lineBeforeCursor.match(/^(\s*[-*+]\s+)\[[ xX]\]\s+(.*)$/)
				if (taskMatch) {
					e.preventDefault()
					const [, indentMarker, body] = taskMatch
					if (!body.trim()) {
						const next = `${value.slice(0, lineStart)}${value.slice(start)}`
						handleUpdateActiveNote({ content: next })
						window.requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart))
						return
					}
					const insert = `\n${indentMarker}[ ] `
					const next = `${value.slice(0, start)}${insert}${value.slice(end)}`
					handleUpdateActiveNote({ content: next })
					window.requestAnimationFrame(() => el.setSelectionRange(start + insert.length, start + insert.length))
					return
				}

				const bulletMatch = lineBeforeCursor.match(/^(\s*[-*+]\s+)(.*)$/)
				if (bulletMatch) {
					e.preventDefault()
					const [, marker, body] = bulletMatch
					if (!body.trim()) {
						const next = `${value.slice(0, lineStart)}${value.slice(start)}`
						handleUpdateActiveNote({ content: next })
						window.requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart))
						return
					}
					const insert = `\n${marker}`
					const next = `${value.slice(0, start)}${insert}${value.slice(end)}`
					handleUpdateActiveNote({ content: next })
					window.requestAnimationFrame(() => el.setSelectionRange(start + insert.length, start + insert.length))
					return
				}

				const orderedMatch = lineBeforeCursor.match(/^(\s*)(\d+)\.\s+(.*)$/)
				if (orderedMatch) {
					e.preventDefault()
					const [, indent, numStr, body] = orderedMatch
					if (!body.trim()) {
						const next = `${value.slice(0, lineStart)}${value.slice(start)}`
						handleUpdateActiveNote({ content: next })
						window.requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart))
						return
					}
					const nextNum = Number(numStr) + 1
					const insert = `\n${indent}${nextNum}. `
					const next = `${value.slice(0, start)}${insert}${value.slice(end)}`
					handleUpdateActiveNote({ content: next })
					window.requestAnimationFrame(() => el.setSelectionRange(start + insert.length, start + insert.length))
				}
			}
		},
		[activeNote.content, applyInlineWrap, handleUpdateActiveNote],
	)

	const toggleTaskCheckboxAtLine = useCallback(
		(oneBasedLine: number) => {
			const lines = activeNote.content.split("\n")
			const index = oneBasedLine - 1
			if (index < 0 || index >= lines.length) {
				return
			}
			const line = lines[index]
			if (/^(\s*[-*+]\s+)\[ \]/.test(line)) {
				lines[index] = line.replace(/^(\s*[-*+]\s+)\[ \]/, "$1[x]")
			} else if (/^(\s*[-*+]\s+)\[[xX]\]/.test(line)) {
				lines[index] = line.replace(/^(\s*[-*+]\s+)\[[xX]\]/, "$1[ ]")
			} else {
				return
			}
			handleUpdateActiveNote({ content: lines.join("\n") })
		},
		[activeNote.content, handleUpdateActiveNote],
	)

	const markdownComponents: Components = useMemo(
		() => ({
			h1: ({ children }) => (
				<h1 className="text-[15px] font-semibold tracking-tight text-[#f1f5f9] mt-3 mb-1.5 first:mt-0 border-b border-[#1e2530] pb-1">
					{children}
				</h1>
			),
			h2: ({ children }) => (
				<h2 className="text-[13.5px] font-semibold tracking-tight text-[#e8ecf1] mt-3 mb-1 first:mt-0">{children}</h2>
			),
			h3: ({ children }) => (
				<h3 className="text-[12.5px] font-semibold text-[#d5dce6] mt-2.5 mb-1 first:mt-0">{children}</h3>
			),
			p: ({ children }) => <p className="text-[12px] leading-[1.65] text-[#cbd5e1] my-1.5 first:mt-0">{children}</p>,
			ul: ({ children }) => (
				<ul className="my-1.5 pl-4 space-y-0.5 text-[12px] leading-[1.6] text-[#cbd5e1] list-disc">{children}</ul>
			),
			ol: ({ children }) => (
				<ol className="my-1.5 pl-4 space-y-0.5 text-[12px] leading-[1.6] text-[#cbd5e1] list-decimal">{children}</ol>
			),
			li: ({ children }) => <li className="marker:text-[#5b6678] [&>input]:list-none">{children}</li>,
			blockquote: ({ children }) => (
				<blockquote className="my-2 border-l-2 border-[#5cc8ff]/50 pl-2.5 text-[#9aa4b2] italic">{children}</blockquote>
			),
			a: ({ href, children }) => (
				<a
					className="text-[#5cc8ff] underline decoration-[#5cc8ff]/40 underline-offset-2 hover:decoration-[#5cc8ff]"
					href={href}
					rel="noopener noreferrer"
					target="_blank">
					{children}
				</a>
			),
			hr: () => <hr className="my-3 border-0 border-t border-[#1e2530]" />,
			pre: ({ children }) => (
				<pre className="my-2 overflow-x-auto rounded-md border border-[#1f2734] bg-[#121720] px-2.5 py-2 text-[11px] leading-relaxed font-mono text-[#d5dce6] [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit [&>code]:border-0">
					{children}
				</pre>
			),
			code: ({ children, className }) => (
				<code
					className={`rounded bg-[#171d27] border border-[#232c3b] px-1 py-0.5 font-mono text-[11px] text-[#7dd3fc] ${className ?? ""}`}>
					{children}
				</code>
			),
			table: ({ children }) => (
				<div className="my-2 overflow-x-auto">
					<table className="w-full border-collapse text-[11px] text-[#cbd5e1]">{children}</table>
				</div>
			),
			th: ({ children }) => (
				<th className="border border-[#252d39] bg-[#141922] px-2 py-1 text-left font-medium text-[#e8ecf1]">{children}</th>
			),
			td: ({ children }) => <td className="border border-[#1e2530] px-2 py-1">{children}</td>,
			input: ({ node, type, checked, ...props }) => {
				if (type !== "checkbox") {
					return <input {...props} type={type} />
				}
				const lineNumber = node?.position?.start?.line
				return (
					<input
						checked={Boolean(checked)}
						className="mr-1.5 -ml-3.5 h-3.5 w-3.5 rounded border-[#323d4f] bg-[#141922] accent-[#5cc8ff] cursor-pointer align-middle"
						onChange={() => {
							if (typeof lineNumber === "number") {
								toggleTaskCheckboxAtLine(lineNumber)
							}
						}}
						onClick={(e) => e.stopPropagation()}
						type="checkbox"
					/>
				)
			},
		}),
		[toggleTaskCheckboxAtLine],
	)

	const filteredNotes = useMemo(() => {
		const q = searchQuery.trim().toLowerCase()
		const sorted = [...notesState.notes].sort((a, b) => b.updatedAt - a.updatedAt)
		if (!q) {
			return sorted
		}
		return sorted.filter(
			(note) => note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q),
		)
	}, [notesState.notes, searchQuery])

	const wordCount = useMemo(() => countWords(activeNote.content), [activeNote.content])

	return (
		<div className="relative flex h-full w-full flex-col bg-[#0d1015] text-[#e8ecf1] select-text">
			{/* Compact Note Tabs & View Switcher Bar */}
			<div className="flex items-center gap-1 px-2 py-1 border-b border-[#1c232e] bg-[#10141c] shrink-0 select-none">
				<button
					className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors cursor-pointer shrink-0 ${
						isDrawerOpen
							? "bg-[#1a2433] text-[#5cc8ff]"
							: "text-[#7d8896] hover:text-[#e8ecf1] hover:bg-[#181f2a]"
					}`}
					onClick={() => {
						setConfirmDeleteId(null)
						setIsDrawerOpen((prev) => !prev)
					}}
					title="Browse all notes"
					type="button">
					<PanelLeft className="w-3 h-3" />
					<span className="tabular-nums">{notesState.notes.length}</span>
				</button>

				<div
					className="flex flex-1 items-center gap-1 overflow-x-auto min-w-0 py-0.5"
					style={{ scrollbarWidth: "none" }}>
					{notesState.notes.map((note) => {
						const isActive = note.id === activeNote.id
						const label = note.title.trim() || "Untitled"
						return (
							<button
								className={`max-w-[120px] truncate px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer shrink-0 ${
									isActive
										? "bg-[#19212e] text-[#eef2f7] font-medium border border-[#2a3547]"
										: "text-[#7d8896] hover:text-[#cbd5e1] hover:bg-[#151b25] border border-transparent"
								}`}
								key={note.id}
								onClick={() => handleSelectNote(note.id)}
								title={label}
								type="button">
								{label}
							</button>
						)
					})}
					<button
						className="p-1 rounded-md text-[#7d8896] hover:text-[#5cc8ff] hover:bg-[#181f2a] transition-colors cursor-pointer shrink-0"
						onClick={handleCreateNote}
						title="New note"
						type="button">
						<Plus className="w-3 h-3" />
					</button>
				</div>

				<div className="flex items-center rounded-md bg-[#0b0e13] border border-[#1f2734] p-0.5 shrink-0">
					<button
						className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
							viewMode === "edit"
								? "bg-[#1a2230] text-[#e8ecf1] font-medium"
								: "text-[#737e8f] hover:text-[#cbd5e1]"
						}`}
						onClick={() => setViewMode("edit")}
						title="Edit Markdown (Ctrl/Cmd+E)"
						type="button">
						<PenLine className="w-2.5 h-2.5" />
						<span>Write</span>
					</button>
					<button
						className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
							viewMode === "preview"
								? "bg-[#1a2230] text-[#5cc8ff] font-medium"
								: "text-[#737e8f] hover:text-[#cbd5e1]"
						}`}
						onClick={() => setViewMode("preview")}
						title="Preview Markdown (Ctrl/Cmd+E)"
						type="button">
						<Eye className="w-2.5 h-2.5" />
						<span>Read</span>
					</button>
				</div>
			</div>

			{/* Main Document Canvas */}
			<div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
				<div className="px-3.5 pt-3 pb-1.5 shrink-0">
					<input
						aria-label="Note title"
						className="w-full bg-transparent border-0 outline-none text-[14px] font-semibold tracking-tight text-[#f1f5f9] placeholder:text-[#4b5668]"
						onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault()
								setViewMode("edit")
								window.requestAnimationFrame(() => textareaRef.current?.focus())
							}
						}}
						placeholder="Untitled note"
						ref={titleInputRef}
						type="text"
						value={activeNote.title}
					/>
				</div>

				{viewMode === "edit" ? (
					<textarea
						aria-label="Note markdown content"
						className="flex-1 w-full resize-none bg-transparent border-0 outline-none px-3.5 pb-3 text-[12px] leading-[1.65] text-[#d5dce6] placeholder:text-[#4a5568] font-sans"
						onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
						onKeyDown={handleEditorKeyDown}
						placeholder="Jot down thoughts in Markdown...  # heading  ·  - [ ] task  ·  **bold**  ·  `code`"
						ref={textareaRef}
						spellCheck
						style={{ scrollbarWidth: "thin" }}
						value={activeNote.content}
					/>
				) : (
					<div
						className="flex-1 overflow-y-auto px-3.5 pb-3 cursor-text"
						onDoubleClick={() => {
							setViewMode("edit")
							window.requestAnimationFrame(() => textareaRef.current?.focus())
						}}
						style={{ scrollbarWidth: "thin" }}>
						{activeNote.content.trim() ? (
							<ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
								{activeNote.content}
							</ReactMarkdown>
						) : (
							<div className="h-full flex items-center justify-center text-[11px] text-[#556072] select-none">
								Nothing written yet — double-click to start typing
							</div>
						)}
					</div>
				)}

				{/* Slide-over All Notes Drawer */}
				{isDrawerOpen && (
					<div className="absolute inset-0 z-10 flex bg-[#0b0e13]/75 backdrop-blur-[2px]">
						<div className="w-[min(240px,84%)] h-full bg-[#111620] border-r border-[#232c3b] shadow-2xl flex flex-col">
							<div className="flex items-center justify-between px-2.5 py-2 border-b border-[#1c2432] shrink-0">
								<span className="text-[11px] font-medium text-[#d5dce6]">
									All Notes <span className="text-[#647082] font-normal">({notesState.notes.length})</span>
								</span>
								<div className="flex items-center gap-0.5">
									<button
										className="p-1 rounded text-[#7d8896] hover:text-[#5cc8ff] hover:bg-[#1a2230] transition-colors cursor-pointer"
										onClick={handleCreateNote}
										title="New note"
										type="button">
										<Plus className="w-3.5 h-3.5" />
									</button>
									<button
										className="p-1 rounded text-[#7d8896] hover:text-[#e8ecf1] hover:bg-[#1a2230] transition-colors cursor-pointer"
										onClick={() => setIsDrawerOpen(false)}
										title="Close list"
										type="button">
										<X className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>

							{notesState.notes.length > 2 && (
								<div className="px-2 pt-2 pb-1 shrink-0">
									<div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0d1015] border border-[#222b3a] focus-within:border-[#5cc8ff]/50">
										<Search className="w-3 h-3 text-[#647082] shrink-0" />
										<input
											className="w-full bg-transparent border-0 outline-none text-[11px] text-[#e8ecf1] placeholder:text-[#556072]"
											onChange={(e) => setSearchQuery(e.target.value)}
											placeholder="Filter notes..."
											type="text"
											value={searchQuery}
										/>
										{searchQuery && (
											<button
												className="text-[#647082] hover:text-[#cbd5e1] cursor-pointer"
												onClick={() => setSearchQuery("")}
												type="button">
												<X className="w-2.5 h-2.5" />
											</button>
										)}
									</div>
								</div>
							)}

							<div className="flex-1 overflow-y-auto p-1.5 space-y-0.5" style={{ scrollbarWidth: "thin" }}>
								{filteredNotes.length === 0 ? (
									<div className="px-2 py-6 text-center text-[11px] text-[#647082]">No matching notes</div>
								) : (
									filteredNotes.map((note) => {
										const isActive = note.id === activeNote.id
										const isConfirming = confirmDeleteId === note.id
										return (
											<div
												className={`group flex items-start justify-between gap-1.5 px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
													isActive
														? "bg-[#182230] border border-[#2c3a4f]"
														: "hover:bg-[#161c27] border border-transparent"
												}`}
												key={note.id}
												onClick={() => handleSelectNote(note.id)}>
												<div className="min-w-0 flex-1">
													<div className="flex items-center justify-between gap-1">
														<span
															className={`truncate text-[11.5px] ${
																isActive ? "font-medium text-[#f1f5f9]" : "text-[#cbd5e1]"
															}`}>
															{note.title.trim() || "Untitled"}
														</span>
													</div>
													<div className="truncate text-[10px] text-[#6b7688] mt-0.5">
														{getNotePreviewLine(note.content)}
													</div>
													<div className="text-[9.5px] text-[#505b6d] mt-0.5">
														{formatRelativeTime(note.updatedAt)}
													</div>
												</div>
												<div
													className="flex items-center gap-0.5 shrink-0 pt-0.5"
													onClick={(e) => e.stopPropagation()}>
													{isConfirming ? (
														<>
															<button
																className="p-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 cursor-pointer"
																onClick={() => performDeleteNote(note.id)}
																title="Confirm delete"
																type="button">
																<Check className="w-3 h-3" />
															</button>
															<button
																className="p-1 rounded text-[#7d8896] hover:text-[#e8ecf1] hover:bg-[#1f2735] cursor-pointer"
																onClick={() => setConfirmDeleteId(null)}
																title="Cancel"
																type="button">
																<X className="w-3 h-3" />
															</button>
														</>
													) : (
														<button
															className="p-1 rounded text-[#556072] opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:bg-[#1f2735] transition-all cursor-pointer"
															onClick={() => handleRequestDelete(note)}
															title="Delete note"
															type="button">
															<Trash2 className="w-3 h-3" />
														</button>
													)}
												</div>
											</div>
										)
									})
								)}
							</div>
						</div>
						<button
							aria-label="Close notes drawer"
							className="flex-1 bg-transparent border-0 cursor-default"
							onClick={() => setIsDrawerOpen(false)}
							type="button"
						/>
					</div>
				)}
			</div>

			{/* Whisper-Quiet Formatting & Status Footer */}
			<div className="flex items-center justify-between gap-2 px-2.5 py-1 border-t border-[#181f2a] bg-[#0f131b] text-[10px] text-[#647082] shrink-0 select-none">
				{viewMode === "edit" ? (
					<div className="flex items-center gap-0.5">
						<button
							className="p-1 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] transition-colors cursor-pointer"
							onClick={() => applyLinePrefix("## ")}
							title="Heading"
							type="button">
							<Heading2 className="w-3 h-3" />
						</button>
						<button
							className="p-1 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] transition-colors cursor-pointer"
							onClick={() => applyInlineWrap("**", "**", "bold")}
							title="Bold (Ctrl/Cmd+B)"
							type="button">
							<Bold className="w-3 h-3" />
						</button>
						<button
							className="p-1 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] transition-colors cursor-pointer"
							onClick={() => applyInlineWrap("*", "*", "italic")}
							title="Italic (Ctrl/Cmd+I)"
							type="button">
							<Italic className="w-3 h-3" />
						</button>
						<button
							className="p-1 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] transition-colors cursor-pointer"
							onClick={() => applyLinePrefix("- ")}
							title="Bullet list"
							type="button">
							<List className="w-3 h-3" />
						</button>
						<button
							className="p-1 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] transition-colors cursor-pointer"
							onClick={() => applyLinePrefix("- [ ] ")}
							title="Task checklist"
							type="button">
							<CheckSquare className="w-3 h-3" />
						</button>
						<button
							className="p-1 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] transition-colors cursor-pointer"
							onClick={() => applyInlineWrap("`", "`", "code")}
							title="Inline code"
							type="button">
							<Code className="w-3 h-3" />
						</button>
					</div>
				) : (
					<span className="truncate text-[#556072]">Double-click to edit</span>
				)}

				<div className="flex items-center gap-1.5 shrink-0">
					<span className="tabular-nums text-[#556072]">
						{wordCount} {wordCount === 1 ? "word" : "words"}
					</span>
					<span className="text-[#2c3544]">·</span>
					<span className="text-[#5d6b80]" title="Saved locally across all projects">
						Saved
					</span>
					<button
						className="p-1 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] transition-colors cursor-pointer"
						onClick={handleCopyMarkdown}
						title={copied ? "Copied Markdown" : "Copy Markdown"}
						type="button">
						{copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
					</button>
					{confirmDeleteId === activeNote.id ? (
						<div className="flex items-center gap-0.5 pl-0.5">
							<button
								className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] cursor-pointer"
								onClick={() => performDeleteNote(activeNote.id)}
								title="Confirm delete note"
								type="button">
								Delete
							</button>
							<button
								className="p-0.5 rounded hover:bg-[#1a2230] hover:text-[#cbd5e1] cursor-pointer"
								onClick={() => setConfirmDeleteId(null)}
								title="Cancel"
								type="button">
								<X className="w-3 h-3" />
							</button>
						</div>
					) : (
						<button
							className="p-1 rounded hover:bg-[#1a2230] hover:text-rose-400 transition-colors cursor-pointer"
							onClick={() => handleRequestDelete(activeNote)}
							title="Delete current note"
							type="button">
							<Trash2 className="w-3 h-3" />
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

export default WaitingNotesPanel