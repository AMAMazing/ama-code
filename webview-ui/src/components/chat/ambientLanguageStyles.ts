export const SIDEBAR_OVERRIDE_CSS = `
    :root {
      --thf: "Noto Sans Thai", "Leelawadee UI", "Thonburi", "Sarabun", sans-serif;
    }

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
      gap: 5px;
      font-size: 11px;
      flex-wrap: nowrap;
      min-height: 28px;
    }

    #bar.hdr2 .l {
      min-width: 0;
      gap: 5px;
      overflow: hidden;
    }

    #bar.hdr2 .brand {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    #bar.hdr2 #trackseg button {
      padding: 3px 6px;
      font-size: 11px;
    }

    #bar.hdr2 #cnt {
      font-size: 10px;
      padding-left: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #bar.hdr2 .r {
      gap: 4px;
    }

    #bar.hdr2 #libbtn,
    #bar.hdr2 #trophbtn,
    #bar.hdr2 #setbtn {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 4px 7px;
      font-size: 11px;
      line-height: 1.2;
      color: var(--tx);
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }

    #bar.hdr2 #libbtn:hover,
    #bar.hdr2 #trophbtn:hover,
    #bar.hdr2 #setbtn:hover {
      border-color: var(--acc);
    }

    #bar.hdr2 #libbtn.on,
    #bar.hdr2 #trophbtn.on,
    #bar.hdr2 #setbtn.on {
      background: #162230;
      border-color: var(--acc);
      color: var(--acc);
    }

    #bar.hdr2 #setbtn .lbl {
      display: none;
    }

    @media (min-width: 390px) {
      #bar.hdr2 #setbtn .lbl {
        display: inline;
      }
    }

    /* Settings Popover */
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

    /* Compact Media Comprehension Cards & Trancy Importer for Sidebar */
    .m-wrap {
      gap: 8px;
    }

    .m-term {
      font-size: clamp(20px, 6vh, 32px);
    }

    .m-cloze {
      font-size: 12px;
      padding: 6px 9px;
    }

    .m-listen-btn {
      padding: 10px 14px;
      font-size: 12px;
    }

    .m-choices {
      gap: 6px;
    }

    .m-choice {
      padding: 7px 9px;
      font-size: 11.5px;
      border-radius: 8px;
    }

    .m-num {
      width: 18px;
      height: 18px;
      font-size: 10px;
    }

    .m-ex {
      padding: 6px 9px;
      font-size: 11px;
    }

    .lib-import {
      padding: 7px;
      gap: 5px;
    }

    .lib-item {
      padding: 5px 8px;
      font-size: 11px;
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

    /* Emoji Trophy Case & Media Library tuned for VS Code sidebar */
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