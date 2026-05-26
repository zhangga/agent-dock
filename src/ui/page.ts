export function renderConsoleHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AgentDock</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #17211e;
        --muted: #5d6b66;
        --line: #d8e0dc;
        --panel: #eef4f1;
        --paper: #fbfcfa;
        --surface: #ffffff;
        --surface-soft: #f5f8f6;
        --accent: #0f766e;
        --accent-2: #b42318;
        --success: #0b5d55;
        --focus: rgba(15, 118, 110, 0.32);
        --shadow: 0 16px 34px rgba(23, 33, 30, 0.1);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: var(--ink);
        background: linear-gradient(180deg, #f7faf8 0%, var(--paper) 44%, #f4f8f6 100%);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 16px;
        line-height: 1.5;
      }

      button,
      input,
      textarea {
        font: inherit;
      }

      button {
        touch-action: manipulation;
      }

      button:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      summary:focus-visible,
      a:focus-visible {
        outline: 3px solid var(--focus);
        outline-offset: 2px;
      }

      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
      }

      .rail {
        position: sticky;
        top: 0;
        align-self: start;
        min-height: 100vh;
        min-width: 0;
        border-right: 1px solid var(--line);
        background: rgba(247, 250, 248, 0.96);
        padding: 28px 24px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
      }

      .mark {
        width: 34px;
        height: 34px;
        border: 2px solid var(--ink);
        background: var(--accent);
        border-radius: 7px;
        box-shadow: 4px 4px 0 var(--ink);
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        font-size: 26px;
        line-height: 1;
        font-weight: 750;
      }

      .caption {
        margin-top: 5px;
        color: var(--muted);
        font-size: 13px;
      }

      .metrics {
        display: grid;
        gap: 8px;
        margin-bottom: 18px;
      }

      .metric {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.66);
        padding: 12px 14px;
      }

      .metric strong {
        display: block;
        font-size: 30px;
        line-height: 1;
        font-weight: 750;
      }

      .metric span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.3;
      }

      .stack-file {
        border-top: 1px solid var(--line);
        padding-top: 16px;
      }

      .stack-file-label {
        font-size: 12px;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .stack-file code {
        display: block;
        margin-bottom: 10px;
        color: var(--ink);
      }

      .stack-file-state {
        margin-bottom: 12px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.4;
      }

      .stack-file-state.missing {
        color: var(--accent-2);
      }

      .stack-file-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .stack-file-actions .button {
        flex: 1 1 auto;
      }

      .button.secondary {
        color: var(--ink);
        background: transparent;
      }

      .button.secondary:hover:not(:disabled) {
        color: var(--paper);
        background: var(--accent);
        border-color: var(--accent);
      }

      .stack-path-form {
        margin-top: 12px;
      }

      .stack-path-form[hidden] {
        display: none;
      }

      .stack-path-input {
        width: 100%;
        margin-bottom: 8px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.92);
        padding: 10px 11px;
        outline: none;
      }

      .stack-path-input:focus {
        border-color: var(--accent);
      }

      .main {
        min-width: 0;
        padding: 32px;
      }

      .toolbar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }

      .toolbar h2 {
        font-size: clamp(28px, 3vw, 38px);
        line-height: 1.08;
        font-weight: 750;
        min-width: 0;
        max-width: 720px;
      }

      .view-subtitle {
        margin-top: 6px;
        color: var(--muted);
        max-width: 640px;
        line-height: 1.45;
      }

      .actions {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
      }

      .search-wrap {
        position: relative;
      }

      .view-tabs {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--line);
        flex-wrap: wrap;
      }

      .view-tab {
        min-width: 106px;
        min-height: 44px;
        border: 1px solid var(--line);
        background: rgba(255, 253, 247, 0.7);
        color: var(--ink);
        border-radius: 6px;
        padding: 10px 13px;
        font-weight: 650;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
      }

      .view-tab:hover,
      .view-tab.active {
        border-color: var(--ink);
        background: var(--ink);
        color: var(--paper);
      }

      .view-panel[hidden] {
        display: none;
      }

      .installed-local-tools {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        margin-bottom: 10px;
      }

      .installed-local-tools-label {
        color: var(--muted);
        font-size: 13px;
      }

      .search {
        min-width: min(320px, 100%);
        border: 1px solid var(--line);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.92);
        padding: 11px 72px 11px 13px;
        outline: none;
      }

      .search:focus {
        border-color: var(--accent);
      }

      .search-clear {
        position: absolute;
        top: 6px;
        right: 6px;
        min-height: 30px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--muted);
        padding: 4px 8px;
        font-size: 13px;
        font-weight: 650;
        cursor: pointer;
      }

      .search-clear:hover:not(:disabled) {
        color: var(--ink);
        background: var(--surface-soft);
      }

      .search-clear[hidden] {
        display: none;
      }

      .button {
        min-height: 44px;
        border: 1px solid var(--ink);
        background: var(--ink);
        color: var(--paper);
        border-radius: 6px;
        padding: 11px 14px;
        font-weight: 650;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
      }

      .button:hover:not(:disabled) {
        background: var(--accent);
      }

      .button:disabled {
        cursor: default;
        color: var(--muted);
        background: transparent;
        border-color: var(--line);
      }

      .status-line {
        color: var(--muted);
        margin-bottom: 16px;
        min-height: 20px;
      }

      .status-line.busy::before {
        content: "";
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 8px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 5px rgba(15, 118, 110, 0.1);
      }

      .stack-panel {
        margin-bottom: 28px;
        padding-bottom: 26px;
        border-bottom: 1px solid var(--line);
      }

      .manual-source-panel {
        margin-bottom: 28px;
        padding-bottom: 26px;
        border-bottom: 1px solid var(--line);
      }

      .manual-source-form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: end;
      }

      .section-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      .section-head > div {
        min-width: 0;
      }

      .kicker {
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .section-head h3 {
        margin-top: 4px;
        font-size: 24px;
        line-height: 1.05;
      }

      .stack-summary {
        color: var(--muted);
        font-size: 13px;
        text-align: right;
      }

      .table-wrap {
        max-width: 100%;
        overflow-x: auto;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 800px;
      }

      th,
      td {
        text-align: left;
        padding: 13px 16px;
        border-bottom: 1px solid var(--line);
        line-height: 1.45;
        vertical-align: top;
      }

      th {
        position: sticky;
        top: 0;
        z-index: 1;
        font-size: 12px;
        text-transform: uppercase;
        color: var(--muted);
        background: var(--panel);
      }

      tbody tr {
        transition: background 140ms ease;
      }

      tbody tr:hover {
        background: rgba(15, 118, 110, 0.035);
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .skill-name {
        font-weight: 700;
        font-size: 16px;
        overflow-wrap: anywhere;
      }

      .desc {
        color: var(--muted);
        max-width: 420px;
      }

      .desc-details {
        max-width: 420px;
      }

      .desc-details summary {
        color: var(--muted);
        cursor: pointer;
        list-style: none;
      }

      .desc-details summary::-webkit-details-marker {
        display: none;
      }

      .desc-details summary::after {
        content: "Details";
        display: inline-block;
        margin-left: 8px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 650;
      }

      .desc-details[open] summary::after {
        content: "Hide";
      }

      .desc-preview {
        display: inline;
        color: var(--muted);
        border-bottom: 1px dashed rgba(104, 115, 110, 0.55);
        line-height: 1.35;
      }

      .desc-full {
        margin-top: 9px;
        padding: 10px 12px;
        color: var(--ink);
        background: var(--panel);
        border-left: 3px solid var(--accent);
        line-height: 1.45;
        box-shadow: 0 10px 24px rgba(25, 32, 29, 0.08);
      }

      .location-badge {
        display: inline-flex;
        align-items: center;
        min-width: 82px;
        justify-content: center;
        border: 1px solid var(--line);
        background: var(--panel);
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 13px;
        color: var(--ink);
      }

      .stack-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 78px;
        border: 1px solid rgba(11, 93, 85, 0.28);
        background: rgba(11, 93, 85, 0.1);
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 13px;
        color: var(--success);
      }

      .stack-status.missing {
        border-color: rgba(180, 35, 24, 0.24);
        background: rgba(180, 35, 24, 0.08);
        color: var(--accent-2);
      }

      .install-command {
        display: block;
        max-width: 360px;
      }

      .install-missing {
        color: var(--accent-2);
        font-size: 13px;
      }

      .install-link {
        display: inline-block;
        margin-top: 6px;
        color: var(--accent);
        font-size: 13px;
        font-weight: 650;
      }

      .restore-preview {
        margin-bottom: 24px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--line);
      }

      .restore-preview-grid {
        display: grid;
        grid-template-columns: minmax(220px, 0.42fr) minmax(320px, 1fr);
        gap: 14px;
        align-items: stretch;
      }

      .restore-preview-list {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .plan-stat {
        min-height: 96px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        padding: 14px;
      }

      .plan-stat strong {
        display: block;
        font-size: 34px;
        line-height: 1;
      }

      .plan-stat span {
        display: block;
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
      }

      .install-script-box {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: end;
      }

      .install-script {
        min-height: 96px;
        width: 100%;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        color: var(--ink);
        padding: 13px;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
        line-height: 1.55;
        outline: none;
      }

      .install-script:focus {
        border-color: var(--accent);
      }

      .restore-actions {
        display: flex;
        align-items: end;
        gap: 10px;
        flex-wrap: wrap;
      }

      .advanced-option {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
      }

      .restore-results {
        margin-top: 14px;
      }

      .restore-results-summary {
        margin-bottom: 10px;
        color: var(--muted);
        font-size: 13px;
      }

      .diagnostics-panel {
        margin-top: 24px;
      }

      .diagnostics-list {
        display: grid;
        gap: 8px;
      }

      .diagnostic-check {
        display: grid;
        grid-template-columns: minmax(140px, 0.24fr) minmax(0, 1fr);
        gap: 12px;
        border: 1px solid var(--line);
        border-left: 4px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        padding: 12px 14px;
      }

      .diagnostic-check.ok {
        border-left-color: var(--success);
      }

      .diagnostic-check.warning {
        border-left-color: #a15c00;
      }

      .diagnostic-check.error {
        border-left-color: var(--accent-2);
      }

      .diagnostic-label {
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .diagnostic-status {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        margin-top: 6px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 3px 8px;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }

      .diagnostic-status.ok {
        border-color: rgba(11, 93, 85, 0.28);
        color: var(--success);
      }

      .diagnostic-status.warning {
        border-color: rgba(161, 92, 0, 0.28);
        color: #7a4600;
      }

      .diagnostic-status.error {
        border-color: rgba(180, 35, 24, 0.24);
        color: var(--accent-2);
      }

      .diagnostic-message {
        color: var(--ink);
      }

      .diagnostic-detail {
        margin-top: 6px;
        color: var(--muted);
        font-size: 13px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .profile-panel {
        margin-top: 24px;
      }

      .update-panel {
        margin-bottom: 28px;
        padding-bottom: 26px;
        border-bottom: 1px solid var(--line);
      }

      .update-results {
        display: grid;
        gap: 8px;
      }

      .update-row {
        display: grid;
        grid-template-columns: minmax(140px, 0.24fr) minmax(110px, auto) minmax(0, 1fr);
        gap: 12px;
        align-items: start;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        padding: 12px 14px;
      }

      .update-status {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 3px 8px;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }

      .update-status.update_available {
        border-color: rgba(180, 35, 24, 0.24);
        color: var(--accent-2);
      }

      .update-status.up_to_date {
        border-color: rgba(11, 93, 85, 0.28);
        color: var(--success);
      }

      .update-status.needs_source {
        border-color: rgba(161, 92, 0, 0.28);
        color: #7a4600;
      }

      .profile-grid {
        display: grid;
        grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
        gap: 14px;
        align-items: start;
      }

      .profile-box {
        display: grid;
        gap: 10px;
      }

      .profile-box h4 {
        margin: 0;
        font-size: 16px;
        line-height: 1.2;
      }

      .profile-help {
        color: var(--muted);
        font-size: 13px;
      }

      .profile-textarea {
        min-height: 170px;
        width: 100%;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        color: var(--ink);
        padding: 12px;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
        line-height: 1.55;
        outline: none;
      }

      .profile-textarea:focus {
        border-color: var(--accent);
      }

      .profile-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .profile-preview {
        display: grid;
        gap: 8px;
      }

      .profile-preview-row {
        display: grid;
        grid-template-columns: minmax(120px, 0.4fr) auto minmax(0, 1fr);
        gap: 10px;
        align-items: start;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        padding: 10px 12px;
      }

      .profile-status {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 3px 8px;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }

      .profile-status.new,
      .profile-status.updated {
        border-color: rgba(11, 93, 85, 0.28);
        color: var(--success);
      }

      .profile-status.invalid {
        border-color: rgba(180, 35, 24, 0.24);
        color: var(--accent-2);
      }

      .manual-command-form {
        display: grid;
        gap: 8px;
        margin-top: 10px;
        max-width: 420px;
      }

      .manual-command-input {
        border: 1px solid var(--line);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.92);
        padding: 9px 10px;
        outline: none;
      }

      .manual-command-input:focus {
        border-color: var(--accent);
      }

      .backup-confirm-dialog,
      .delete-skill-dialog {
        width: min(640px, calc(100vw - 32px));
        border: 1px solid var(--ink);
        border-radius: 8px;
        padding: 0;
        color: var(--ink);
        background: var(--paper);
        box-shadow: var(--shadow);
      }

      .backup-confirm-dialog::backdrop,
      .delete-skill-dialog::backdrop {
        background: rgba(25, 32, 29, 0.28);
      }

      .backup-confirm-form {
        display: grid;
        gap: 14px;
        padding: 22px;
      }

      .backup-confirm-form h3 {
        font-size: 24px;
        line-height: 1.08;
      }

      .backup-confirm-message,
      .backup-command-help {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }

      .backup-command-label {
        display: grid;
        gap: 7px;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }

      .backup-command-input {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.92);
        color: var(--ink);
        padding: 10px 11px;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        outline: none;
      }

      .backup-command-input:focus {
        border-color: var(--accent);
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }

      .add-to-backup,
      .remove-stack-skill,
      .delete-local-skill,
      .retry-restore {
        min-width: 78px;
        min-height: 40px;
        border: 1px solid var(--ink);
        background: transparent;
        color: var(--ink);
        border-radius: 6px;
        padding: 8px 10px;
        font-weight: 650;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
      }

      .add-to-backup:hover:not(:disabled),
      .remove-stack-skill:hover:not(:disabled),
      .delete-local-skill:hover:not(:disabled),
      .retry-restore:hover:not(:disabled) {
        color: var(--paper);
        background: var(--accent);
        border-color: var(--accent);
      }

      .add-to-backup:disabled {
        cursor: default;
        color: var(--success);
        background: rgba(11, 93, 85, 0.1);
        border-color: rgba(11, 93, 85, 0.26);
      }

      .remove-stack-skill:hover:not(:disabled),
      .delete-local-skill:hover:not(:disabled) {
        background: var(--accent-2);
        border-color: var(--accent-2);
      }

      .delete-skill-path {
        display: block;
        margin-top: 8px;
        color: var(--ink);
      }

      code {
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
        overflow-wrap: anywhere;
      }

      .empty,
      .stack-empty,
      .error {
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
      }

      .empty strong,
      .stack-empty strong {
        display: block;
        margin-bottom: 6px;
        color: var(--ink);
        font-size: 18px;
      }

      .empty span,
      .stack-empty span {
        color: var(--muted);
      }

      .error {
        border-color: var(--accent-2);
        color: var(--accent-2);
      }

      @media (max-width: 820px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .rail {
          position: static;
          min-height: auto;
          border-right: 0;
          border-bottom: 1px solid var(--line);
          padding: 24px 16px;
        }

        .metrics {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .metric {
          padding: 10px;
        }

        .metric strong {
          font-size: 24px;
        }

        .metric span {
          font-size: 12px;
        }

        .toolbar {
          align-items: stretch;
          flex-direction: column;
        }

        .toolbar h2 {
          max-width: 100%;
        }

        .section-head {
          align-items: flex-start;
          flex-direction: column;
          gap: 8px;
        }

        .stack-summary {
          text-align: left;
        }

        .main {
          padding: 24px 16px;
        }

        .actions {
          align-items: stretch;
        }

        .search-wrap {
          width: 100%;
        }

        .search {
          width: 100%;
        }

        .installed-local-tools {
          align-items: flex-start;
          flex-direction: column;
        }

        .profile-grid,
        .restore-preview-grid,
        .install-script-box,
        .diagnostic-check,
        .update-row,
        .manual-source-form {
          grid-template-columns: 1fr;
        }

        .restore-preview-list {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 680px) {
        .table-wrap {
          overflow: visible;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        table,
        thead,
        tbody,
        tr,
        td {
          display: block;
          width: 100%;
        }

        table {
          min-width: 0;
        }

        thead {
          display: none;
        }

        tbody tr {
          margin-bottom: 12px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--surface);
          box-shadow: 0 10px 20px rgba(23, 33, 30, 0.06);
        }

        td {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 0;
        }

        td::before {
          content: attr(data-label);
          color: var(--muted);
          font-size: 12px;
          font-weight: 750;
          text-transform: uppercase;
        }

        td:first-child {
          display: block;
          padding-top: 14px;
        }

        td:first-child::before {
          display: none;
        }

        td:last-child {
          padding-bottom: 14px;
        }

        .add-to-backup,
        .remove-stack-skill,
        .delete-local-skill,
        .retry-restore,
        .profile-actions .button,
        .manual-source-form .button,
        .manual-command-form .button {
          width: 100%;
        }

        .install-command,
        .desc,
        .desc-details {
          max-width: 100%;
        }
      }

      @media (max-width: 430px) {
        .metrics {
          grid-template-columns: 1fr;
        }

        .stack-file-actions .button {
          flex-basis: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="rail">
        <div class="brand">
          <div class="mark" aria-hidden="true"></div>
          <div>
            <h1>AgentDock</h1>
            <p class="caption">Skills backup and restore</p>
          </div>
        </div>
        <div class="metrics" aria-label="AgentDock counts">
          <div class="metric">
            <strong id="skill-count">-</strong>
            <span>installed skills</span>
          </div>
          <div class="metric">
            <strong id="root-count">-</strong>
            <span>source roots</span>
          </div>
          <div class="metric">
            <strong id="stack-count">-</strong>
            <span>in backup</span>
          </div>
        </div>
        <div class="stack-file">
          <div class="stack-file-label">Current backup file</div>
          <code id="stack-file-path">-</code>
          <p id="stack-file-state" class="stack-file-state">Checking backup file...</p>
          <div class="stack-file-actions">
            <button id="create-stack" class="button" type="button">Create backup file</button>
            <button id="choose-stack-file" class="button secondary" type="button">Choose backup file...</button>
            <button id="reveal-stack-file" class="button secondary" type="button" disabled>Show file</button>
            <button id="copy-stack-path" class="button secondary" type="button" disabled>Copy path</button>
            <button id="manual-stack-path" class="button secondary" type="button">Enter path manually</button>
          </div>
          <form id="stack-path-form" class="stack-path-form" hidden>
            <label class="stack-file-label" for="stack-path-input">Backup file path</label>
            <input id="stack-path-input" class="stack-path-input" type="text" autocomplete="off" placeholder="~/agentdock-stack.json" />
            <button id="set-stack-path" class="button" type="submit">Use path</button>
          </form>
        </div>
      </aside>
      <main class="main">
        <div class="toolbar">
          <div>
            <h2 id="view-title">My Skills</h2>
            <p id="view-subtitle" class="view-subtitle">Browse local skills and save the ones you want to keep.</p>
          </div>
          <div class="actions">
            <div id="search-wrap" class="search-wrap">
              <input id="search" class="search" type="search" placeholder="Filter skills" autocomplete="off" aria-label="Filter installed skills" />
              <button id="clear-search" class="search-clear" type="button" hidden>Clear</button>
            </div>
            <button id="refresh" class="button" type="button">Refresh</button>
          </div>
        </div>
        <div class="view-tabs" role="tablist" aria-label="AgentDock sections">
          <button id="installed-tab" class="view-tab active" role="tab" type="button" aria-selected="true" aria-controls="installed-panel" data-view="installed">Installed</button>
          <button id="backup-tab" class="view-tab" role="tab" type="button" aria-selected="false" aria-controls="backup-panel" data-view="backup">Backup</button>
          <button id="restore-tab" class="view-tab" role="tab" type="button" aria-selected="false" aria-controls="restore-panel" data-view="restore">Restore</button>
        </div>
        <p id="status-line" class="status-line">Scanning local skill directories...</p>
        <section id="installed-panel" class="view-panel" role="tabpanel" aria-labelledby="installed-tab" data-view="installed">
          <div class="installed-local-tools">
            <span class="installed-local-tools-label">Local uninstall</span>
            <button id="show-delete-controls" class="button secondary" type="button" aria-pressed="false">Show uninstall</button>
          </div>
          <section id="skill-list" aria-live="polite"></section>
        </section>
        <section id="backup-panel" class="view-panel" role="tabpanel" aria-labelledby="backup-tab" data-view="backup" hidden>
          <section class="manual-source-panel" aria-labelledby="manual-source-heading">
            <div class="section-head">
              <div>
                <p class="kicker">Add by source</p>
                <h3 id="manual-source-heading">Manual restore source</h3>
              </div>
            </div>
            <form id="manual-source-form" class="manual-source-form">
              <label class="backup-command-label" for="manual-source-input">
                Install command or GitHub skill URL
                <input id="manual-source-input" class="backup-command-input" type="text" autocomplete="off" placeholder="https://github.com/owner/repo/tree/main/skills/skill-name" />
              </label>
              <button id="manual-source-save" class="button" type="submit">Add source</button>
            </form>
          </section>
          <section class="update-panel" aria-labelledby="update-heading">
            <div class="section-head">
              <div>
                <p class="kicker">Update Check</p>
                <h3 id="update-heading">Check saved skill updates</h3>
              </div>
              <div class="restore-actions">
                <span id="update-summary" class="stack-summary">Not checked yet</span>
                <button id="check-updates" class="button secondary" type="button">Check updates</button>
              </div>
            </div>
            <div id="update-results" class="update-results" aria-live="polite">
              <div class="stack-empty"><strong>Updates not checked yet</strong><span>Run a check to review saved skills and refresh commands.</span></div>
            </div>
          </section>
          <section class="stack-panel" aria-labelledby="backup-heading">
            <div class="section-head">
              <div>
                <p class="kicker">Backup Contents</p>
                <h3 id="backup-heading">Saved skills</h3>
              </div>
              <span id="stack-summary" class="stack-summary">-</span>
            </div>
            <div id="backup-list" aria-live="polite"></div>
          </section>
          <section class="profile-panel" aria-labelledby="profile-heading">
            <div class="section-head">
              <div>
                <p class="kicker">Profile Sync</p>
                <h3 id="profile-heading">Export and import profiles</h3>
              </div>
              <span id="profile-import-summary" class="stack-summary">No profile preview yet</span>
            </div>
            <div class="profile-grid">
              <div class="profile-box">
                <h4>Export profile</h4>
                <p class="profile-help">Generate a portable profile from the current Backup.</p>
                <textarea id="profile-export" class="profile-textarea" readonly spellcheck="false" aria-label="Generated profile JSON"></textarea>
                <div class="profile-actions">
                  <button id="export-profile" class="button" type="button">Export profile</button>
                  <button id="copy-profile" class="button secondary" type="button" disabled>Copy profile</button>
                </div>
              </div>
              <div class="profile-box">
                <h4>Import profile</h4>
                <p class="profile-help">Paste an AgentDock profile, preview the changes, then apply it to Backup.</p>
                <textarea id="profile-import-input" class="profile-textarea" spellcheck="false" aria-label="Profile JSON to import"></textarea>
                <div class="profile-actions">
                  <button id="preview-profile-import" class="button secondary" type="button">Preview import</button>
                  <button id="apply-profile-import" class="button" type="button" disabled>Apply import</button>
                </div>
                <div id="profile-import-preview" class="profile-preview" aria-live="polite"></div>
              </div>
            </div>
          </section>
        </section>
        <section id="restore-panel" class="view-panel" role="tabpanel" aria-labelledby="restore-tab" data-view="restore" hidden>
          <section id="restore-preview" class="restore-preview" aria-labelledby="restore-preview-heading">
            <div class="section-head">
              <div>
                <p class="kicker">Restore Preview</p>
                <h3 id="restore-preview-heading">Restore missing skills</h3>
              </div>
              <span id="restore-preview-summary" class="stack-summary">-</span>
            </div>
            <div class="restore-preview-grid">
              <div id="restore-preview-list" class="restore-preview-list" aria-live="polite"></div>
              <div class="install-script-box">
                <textarea id="install-script" class="install-script" readonly spellcheck="false" aria-label="Generated install script"></textarea>
                <div class="restore-actions">
                  <button id="start-restore" class="button" type="button" disabled>Start restore</button>
                  <button id="copy-install-script" class="button secondary" type="button" disabled>Copy install script</button>
                  <span class="advanced-option">Advanced option</span>
                </div>
              </div>
            </div>
            <div id="restore-results" class="restore-results" aria-live="polite"></div>
          </section>
          <section id="diagnostics-panel" class="diagnostics-panel" aria-labelledby="diagnostics-heading">
            <div class="section-head">
              <div>
                <p class="kicker">Diagnostics</p>
                <h3 id="diagnostics-heading">Restore health check</h3>
              </div>
              <div class="restore-actions">
                <span id="diagnostics-summary" class="stack-summary">Not checked yet</span>
                <button id="run-diagnostics" class="button secondary" type="button">Run diagnostics</button>
              </div>
            </div>
            <div id="diagnostics-list" class="diagnostics-list" aria-live="polite">
              <div class="stack-empty"><strong>Diagnostics not run yet</strong><span>Run checks when restore fails or before moving a backup to another machine.</span></div>
            </div>
          </section>
        </section>
      </main>
    </div>
    <dialog id="backup-confirm-dialog" class="backup-confirm-dialog" aria-labelledby="backup-confirm-heading">
      <form id="backup-confirm-form" class="backup-confirm-form">
        <h3 id="backup-confirm-heading">Confirm backup command</h3>
        <p id="backup-confirm-message" class="backup-confirm-message">Review the install command before this skill is saved.</p>
        <label class="backup-command-label" for="backup-command-input">
          Install command or GitHub skill URL
          <input id="backup-command-input" class="backup-command-input" type="text" autocomplete="off" placeholder="npx skills add https://github.com/owner/repo --skill skill-name" />
        </label>
        <p id="backup-command-help" class="backup-command-help">This backup needs an install command or GitHub skill URL before it can be saved.</p>
        <div class="dialog-actions">
          <button id="cancel-backup-confirm" class="button secondary" type="button">Cancel</button>
          <button id="confirm-backup-save" class="button" type="submit">Save to backup</button>
        </div>
      </form>
    </dialog>
    <dialog id="delete-skill-dialog" class="delete-skill-dialog" aria-labelledby="delete-skill-heading">
      <form id="delete-skill-form" class="backup-confirm-form">
        <h3 id="delete-skill-heading">Uninstall skill</h3>
        <p id="delete-skill-message" class="backup-confirm-message">This will remove the skill from local agent installs.</p>
        <p class="backup-command-help">
          This will not remove the skill from Backup.
          <code id="delete-skill-path" class="delete-skill-path">-</code>
        </p>
        <div class="dialog-actions">
          <button id="cancel-delete-skill" class="button secondary" type="button">Cancel</button>
          <button id="confirm-delete-skill" class="button" type="submit">Uninstall</button>
        </div>
      </form>
    </dialog>
    <script>
      const state = {
        skills: [],
        stack: { skills: [] },
        stackFile: { path: "", exists: false },
        diagnostics: { checks: [], summary: { ok: 0, warning: 0, error: 0 }, loaded: false, loading: false },
        updates: { items: [], summary: null, loaded: false, loading: false },
        profileImportPreview: null,
        restoreResults: [],
        pendingBackup: null,
        pendingDelete: null,
        showDeleteControls: false,
        activeView: "installed"
      };
      const list = document.querySelector("#skill-list");
      const backupList = document.querySelector("#backup-list");
      const manualSourceForm = document.querySelector("#manual-source-form");
      const manualSourceInput = document.querySelector("#manual-source-input");
      const stackSummary = document.querySelector("#stack-summary");
      const profileExport = document.querySelector("#profile-export");
      const exportProfileButton = document.querySelector("#export-profile");
      const copyProfileButton = document.querySelector("#copy-profile");
      const profileImportInput = document.querySelector("#profile-import-input");
      const previewProfileImportButton = document.querySelector("#preview-profile-import");
      const applyProfileImportButton = document.querySelector("#apply-profile-import");
      const profileImportSummary = document.querySelector("#profile-import-summary");
      const profileImportPreview = document.querySelector("#profile-import-preview");
      const restorePreviewSummary = document.querySelector("#restore-preview-summary");
      const restorePreviewList = document.querySelector("#restore-preview-list");
      const restoreResults = document.querySelector("#restore-results");
      const installScript = document.querySelector("#install-script");
      const copyInstallScript = document.querySelector("#copy-install-script");
      const startRestoreButton = document.querySelector("#start-restore");
      const diagnosticsSummary = document.querySelector("#diagnostics-summary");
      const diagnosticsList = document.querySelector("#diagnostics-list");
      const runDiagnosticsButton = document.querySelector("#run-diagnostics");
      const updateSummary = document.querySelector("#update-summary");
      const updateResults = document.querySelector("#update-results");
      const checkUpdatesButton = document.querySelector("#check-updates");
      const statusLine = document.querySelector("#status-line");
      const search = document.querySelector("#search");
      const searchWrap = document.querySelector("#search-wrap");
      const clearSearch = document.querySelector("#clear-search");
      const showDeleteControlsButton = document.querySelector("#show-delete-controls");
      const refresh = document.querySelector("#refresh");
      const viewTitle = document.querySelector("#view-title");
      const viewSubtitle = document.querySelector("#view-subtitle");
      const viewTabs = document.querySelectorAll(".view-tab");
      const viewPanels = document.querySelectorAll(".view-panel");
      const skillCount = document.querySelector("#skill-count");
      const rootCount = document.querySelector("#root-count");
      const stackCount = document.querySelector("#stack-count");
      const stackFilePath = document.querySelector("#stack-file-path");
      const stackFileState = document.querySelector("#stack-file-state");
      const createStack = document.querySelector("#create-stack");
      const chooseStackFileButton = document.querySelector("#choose-stack-file");
      const revealStackFileButton = document.querySelector("#reveal-stack-file");
      const copyStackPathButton = document.querySelector("#copy-stack-path");
      const manualStackPath = document.querySelector("#manual-stack-path");
      const stackPathForm = document.querySelector("#stack-path-form");
      const stackPathInput = document.querySelector("#stack-path-input");
      const backupConfirmDialog = document.querySelector("#backup-confirm-dialog");
      const backupConfirmForm = document.querySelector("#backup-confirm-form");
      const backupConfirmMessage = document.querySelector("#backup-confirm-message");
      const backupCommandInput = document.querySelector("#backup-command-input");
      const backupCommandHelp = document.querySelector("#backup-command-help");
      const cancelBackupConfirm = document.querySelector("#cancel-backup-confirm");
      const deleteSkillDialog = document.querySelector("#delete-skill-dialog");
      const deleteSkillForm = document.querySelector("#delete-skill-form");
      const deleteSkillMessage = document.querySelector("#delete-skill-message");
      const deleteSkillPath = document.querySelector("#delete-skill-path");
      const cancelDeleteSkill = document.querySelector("#cancel-delete-skill");

      async function loadSkills() {
        statusLine.textContent = "Scanning local skill directories...";
        statusLine.classList.add("busy");
        list.innerHTML = "";
        list.setAttribute("aria-busy", "true");
        refresh.disabled = true;

        try {
          const [skillsResponse, stackResponse] = await Promise.all([
            fetch("/api/skills"),
            fetch("/api/stack")
          ]);
          if (!skillsResponse.ok) throw new Error("Skills request failed with " + skillsResponse.status);
          if (!stackResponse.ok) throw new Error("Stack request failed with " + stackResponse.status);
          const skillsPayload = await skillsResponse.json();
          const stackPayload = await stackResponse.json();
          state.skills = skillsPayload.skills || [];
          state.stack = stackPayload.stack || { skills: [] };
          state.stackFile = stackPayload.stackFile || state.stackFile;
          render();
        } catch (error) {
          skillCount.textContent = "0";
          rootCount.textContent = "0";
          stackCount.textContent = "0";
          stackFilePath.textContent = "-";
          stackFileState.textContent = "Could not check stack file.";
          statusLine.textContent = "Scan failed";
          list.innerHTML = '<div class="error">Could not scan local skills. Check the terminal for details.</div>';
        } finally {
          refresh.disabled = false;
          list.removeAttribute("aria-busy");
          statusLine.classList.remove("busy");
        }
      }

      function render() {
        const query = search.value.trim().toLowerCase();
        const saved = new Set(state.stack.skills.map(stackSkillKey));
        const installed = new Set(state.skills.map(installedSkillKey));
        const installedById = getInstalledSkillById();
        const filtered = filterSkills(query);

        const roots = new Set(state.skills.map((skill) => skill.sourceRoot));
        skillCount.textContent = String(state.skills.length);
        rootCount.textContent = String(roots.size);
        stackCount.textContent = String(state.stack.skills.length);
        renderTabCounts(installed);
        renderStackFile();
        renderBackupContents(installed, installedById);
        renderUpdateResults();
        renderProfileImportPreview();
        renderRestorePreview(installed);
        renderDiagnostics();
        activateView(state.activeView);
        statusLine.textContent = getActiveStatusLine(filtered);

        if (filtered.length === 0) {
          list.innerHTML = query
            ? '<div class="empty"><strong>No matches found</strong><span>Try another name, location, or path fragment.</span></div>'
            : '<div class="empty"><strong>No installed skills found</strong><span>Refresh after installing skills or add a custom skill root from the CLI.</span></div>';
          return;
        }

        list.innerHTML = [
          '<div class="table-wrap">',
          '<table>',
          '<thead><tr><th>Name</th><th>Description</th><th>Location</th><th>Install path</th><th>Backup</th>' + (state.showDeleteControls ? '<th>Uninstall</th>' : '') + '</tr></thead>',
          '<tbody>',
          ...filtered.map((skill) => {
            const isSaved = saved.has(stackSkillKey(skill));
            const deleteCell = state.showDeleteControls
              ? '<td data-label="Uninstall"><button class="delete-local-skill" type="button" data-id="' + escapeHtml(skill.id) + '" data-name="' + escapeHtml(skill.name) + '" data-install-path="' + escapeHtml(skill.installPath) + '">Uninstall</button></td>'
              : "";
            return [
            '<tr>',
            '<td data-label="Name"><div class="skill-name">' + escapeHtml(skill.name) + '</div></td>',
            '<td class="desc" data-label="Description">' + renderDescription(skill.description) + '</td>',
            '<td data-label="Location">' + renderLocation(skill) + '</td>',
            '<td data-label="Install path"><code>' + escapeHtml(skill.installPath) + '</code></td>',
            '<td data-label="Backup"><button class="add-to-backup" type="button" data-id="' + escapeHtml(skill.id) + '" data-install-path="' + escapeHtml(skill.installPath) + '"' + (isSaved ? ' disabled' : '') + '>' + (isSaved ? 'In backup' : 'Add to backup') + '</button></td>',
            deleteCell,
            '</tr>'
          ].join("");
          }),
          '</tbody>',
          '</table>',
          '</div>'
        ].join("");
      }

      function activateView(view) {
        const nextView = ["installed", "backup", "restore"].includes(view) ? view : "installed";
        state.activeView = nextView;
        const titles = {
          installed: "My Skills",
          backup: "Backup",
          restore: "Restore"
        };
        const subtitles = {
          installed: "Browse local skills and save the ones you want to keep.",
          backup: "Review the portable restore sources saved in your backup file.",
          restore: "Preview what another machine would install from this backup."
        };

        viewTitle.textContent = titles[nextView] || "My Skills";
        viewSubtitle.textContent = subtitles[nextView] || subtitles.installed;
        searchWrap.hidden = nextView !== "installed";
        showDeleteControlsButton.hidden = nextView !== "installed";
        showDeleteControlsButton.textContent = state.showDeleteControls ? "Hide uninstall" : "Show uninstall";
        showDeleteControlsButton.setAttribute("aria-pressed", state.showDeleteControls ? "true" : "false");
        clearSearch.hidden = nextView !== "installed" || !search.value;

        viewTabs.forEach((tab) => {
          const isActive = tab.dataset.view === nextView;
          tab.classList.toggle("active", isActive);
          tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        viewPanels.forEach((panel) => {
          panel.hidden = panel.dataset.view !== nextView;
        });

        statusLine.textContent = getActiveStatusLine();
      }

      function filterSkills(query) {
        return state.skills.filter((skill) => {
          return [skill.name, skill.description, skill.installPath, skill.sourceRoot, skill.location && skill.location.label]
            .join(" ")
            .toLowerCase()
            .includes(query);
        });
      }

      function renderTabCounts(installed) {
        const plan = getRestorePlan(installed);
        const missingCount = plan.installable.length + plan.needsAttention.length;
        document.querySelector("#installed-tab").textContent = "Installed (" + state.skills.length + ")";
        document.querySelector("#backup-tab").textContent = "Backup (" + (state.stack.skills || []).length + ")";
        document.querySelector("#restore-tab").textContent = "Restore (" + missingCount + ")";
      }

      function getActiveStatusLine(filteredOverride) {
        const query = search.value.trim().toLowerCase();

        if (state.activeView === "backup") {
          const installed = new Set(state.skills.map(installedSkillKey));
          const stackSkills = state.stack.skills || [];
          const installedCount = stackSkills.filter((skill) => installed.has(installedSkillKey(skill))).length;
          return stackSkills.length
            ? installedCount + " installed / " + stackSkills.length + " in backup"
            : "No skills in backup yet";
        }

        if (state.activeView === "restore") {
          const installed = new Set(state.skills.map(installedSkillKey));
          const plan = getRestorePlan(installed);
          if (plan.installable.length > 0) {
            return plan.installable.length + " missing skills are ready to restore";
          }
          if (plan.needsAttention.length > 0) {
            return plan.needsAttention.length + " backup skills need an install command";
          }
          return (state.stack.skills || []).length
            ? "All backup skills are already installed"
            : "No backup skills to restore";
        }

        const filtered = filteredOverride || filterSkills(query);
        return query
          ? filtered.length + " of " + state.skills.length + " skills match"
          : state.skills.length + " installed skills found";
      }

      function renderBackupContents(installed, installedById) {
        const stackSkills = state.stack.skills || [];
        const installedCount = stackSkills.filter((skill) => installed.has(installedSkillKey(skill))).length;
        stackSummary.textContent = stackSkills.length
          ? installedCount + " installed / " + stackSkills.length + " in backup"
          : "0 in backup";

        if (stackSkills.length === 0) {
          backupList.innerHTML = '<div class="stack-empty"><strong>No skills saved yet</strong><span>Add skills from the Installed tab to build a portable backup.</span></div>';
          return;
        }

        backupList.innerHTML = [
          '<div class="table-wrap">',
          '<table>',
          '<thead><tr><th>Name</th><th>Status</th><th>Restore source</th><th>Location</th><th></th></tr></thead>',
          '<tbody>',
          ...stackSkills.map((skill) => {
            const isInstalled = installed.has(installedSkillKey(skill));
            const currentSkill = installedById.get(skill.id);
            return [
              '<tr>',
              '<td data-label="Name"><div class="skill-name">' + escapeHtml(currentSkill ? currentSkill.name : skill.id) + '</div></td>',
              '<td data-label="Status">' + renderStackStatus(isInstalled) + '</td>',
              '<td data-label="Restore source">' + renderRestoreSource(skill) + renderManualCommandForm(skill) + '</td>',
              '<td data-label="Location">' + renderStackLocation(currentSkill) + '</td>',
              '<td data-label="Action"><button class="remove-stack-skill" type="button" data-id="' + escapeHtml(skill.id) + '">Remove</button></td>',
              '</tr>'
            ].join("");
          }),
          '</tbody>',
          '</table>',
          '</div>'
        ].join("");
      }

      function renderRestorePreview(installed) {
        const plan = getRestorePlan(installed);
        const script = buildInstallScript(plan);

        restorePreviewSummary.textContent =
          plan.alreadyInstalled.length + " installed / " +
          plan.installable.length + " restorable / " +
          plan.needsAttention.length + " needs attention";

        restorePreviewList.innerHTML = [
          renderPlanStat(plan.alreadyInstalled.length, "Installed"),
          renderPlanStat(plan.installable.length, "Restorable"),
          renderPlanStat(plan.needsAttention.length, "Needs attention")
        ].join("");

        installScript.value = script || "# No missing restorable skills.";
        copyInstallScript.disabled = !script;
        startRestoreButton.disabled = plan.installable.length === 0;
        renderRestoreResults();
      }

      function getRestorePlan(installed) {
        const plan = {
          alreadyInstalled: [],
          installable: [],
          needsAttention: []
        };

        for (const skill of state.stack.skills || []) {
          const command = getInstallCommand(skill);

          if (installed.has(installedSkillKey(skill))) {
            plan.alreadyInstalled.push(skill);
          } else if (command) {
            plan.installable.push(skill);
          } else {
            plan.needsAttention.push(skill);
          }
        }

        return plan;
      }

      function buildInstallScript(plan) {
        const commands = [];
        const seen = new Set();

        for (const skill of plan.installable) {
          const command = getInstallCommand(skill);
          if (!command || seen.has(command)) continue;
          seen.add(command);
          commands.push(command);
        }

        return commands.join("\\n");
      }

      function renderPlanStat(count, label) {
        return '<div class="plan-stat"><strong>' + escapeHtml(count) + '</strong><span>' + escapeHtml(label) + '</span></div>';
      }

      function renderStackFile() {
        stackFilePath.textContent = state.stackFile.path || "-";
        stackFileState.classList.toggle("missing", !state.stackFile.exists);
        stackFileState.textContent = state.stackFile.exists
          ? "Ready"
          : "No backup file yet. Create it here or choose a backup file.";
        createStack.hidden = Boolean(state.stackFile.exists);
        revealStackFileButton.disabled = !state.stackFile.exists;
        copyStackPathButton.disabled = !state.stackFile.path;
      }

      function renderLocation(skill) {
        const location = skill.location || { label: "Custom", root: skill.sourceRoot };
        return '<span class="location-badge" title="' + escapeHtml(location.root || skill.sourceRoot) + '">' + escapeHtml(location.label || "Custom") + '</span>';
      }

      function renderStackLocation(currentSkill) {
        if (!currentSkill) {
          return '<span class="install-missing">Not installed</span>';
        }

        return renderLocation(currentSkill);
      }

      function renderStackStatus(isInstalled) {
        return isInstalled
          ? '<span class="stack-status">Installed</span>'
          : '<span class="stack-status missing">Missing</span>';
      }

      function renderRestoreSource(skill) {
        const command = getInstallCommand(skill);

        if (command) {
          const url = getSkillsShUrl(skill);
          const link = url
            ? '<a class="install-link" href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer">skills.sh</a>'
            : "";
          return '<code class="install-command">' + escapeHtml(command) + '</code>' + link;
        }

        return '<span class="install-missing">This skill does not have a restore source yet.</span>';
      }

      function renderManualCommandForm(skill) {
        const source = skill.source || { type: "unknown" };
        if (source.type !== "unknown") {
          return "";
        }

        return [
          '<form class="manual-command-form" data-id="' + escapeHtml(skill.id) + '">',
          '<input class="manual-command-input" type="text" autocomplete="off" placeholder="npx skills add ... or GitHub skill URL" />',
          '<button class="button secondary" type="submit">Save and add to restore</button>',
          '</form>'
        ].join("");
      }

      function getInstallCommand(skill) {
        const source = skill.source || { type: "unknown" };

        if (source.type === "skills.sh" && source.package && source.skill) {
          return "npx skills add https://github.com/" + source.package + " --skill " + source.skill;
        }

        if (source.type === "command" && source.install) {
          return source.install;
        }

        return "";
      }

      function getSkillsShUrl(skill) {
        const source = skill.source || { type: "unknown" };

        if (source.type !== "skills.sh" || !source.package || !source.skill) {
          return "";
        }

        return "https://skills.sh/" + source.package + "/" + source.skill;
      }

      function renderDescription(description) {
        const fullDescription = String(description || "No description").trim() || "No description";
        const preview = previewDescription(fullDescription);

        if (fullDescription === "No description") {
          return '<span class="desc-preview">No description</span>';
        }

        return [
          '<details class="desc-details">',
          '<summary><span class="desc-preview">' + escapeHtml(preview) + '</span></summary>',
          '<div class="desc-full">' + escapeHtml(fullDescription) + '</div>',
          '</details>'
        ].join("");
      }

      function previewDescription(description) {
        const compact = String(description).replace(/\\s+/g, " ").trim();
        const maxLength = 72;
        return compact.length > maxLength ? compact.slice(0, maxLength).trimEnd() + "..." : compact;
      }

      async function resolveSkillBeforeBackup(id, installPath, button) {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Checking...";
        statusLine.textContent = "Finding restore source before saving...";

        const response = await fetch("/api/stack/skills/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, installPath })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not check restore source";
          button.disabled = false;
          button.textContent = originalText;
          return;
        }

        openBackupConfirm({
          id,
          installPath,
          name: payload.skill && payload.skill.name ? payload.skill.name : id,
          command: payload.command || "",
          reason: payload.install && payload.install.reason ? payload.install.reason : ""
        });
        button.disabled = false;
        button.textContent = originalText;
      }

      function openBackupConfirm(pendingBackup) {
        state.pendingBackup = {
          id: pendingBackup.id,
          installPath: pendingBackup.installPath
        };
        backupCommandInput.value = pendingBackup.command || "";

        if (pendingBackup.command) {
          backupConfirmMessage.textContent = "AgentDock found a restore command for " + pendingBackup.name + ". Review it before saving.";
          backupCommandHelp.textContent = "This command will be used to install the skill on another computer.";
        } else {
          backupConfirmMessage.textContent = "AgentDock could not find a matching skills.sh entry for " + pendingBackup.name + ".";
          backupCommandHelp.textContent = pendingBackup.reason || "Paste a npx skills add command or GitHub skill URL before this skill can be saved.";
        }

        statusLine.textContent = pendingBackup.command
          ? "Review install command before saving"
          : "Enter an install command or GitHub skill URL before saving";

        if (typeof backupConfirmDialog.showModal === "function") {
          backupConfirmDialog.showModal();
        } else {
          backupConfirmDialog.setAttribute("open", "");
        }

        backupCommandInput.focus();
        backupCommandInput.select();
      }

      function closeBackupConfirm() {
        state.pendingBackup = null;
        backupCommandInput.value = "";
        if (backupConfirmDialog.open && typeof backupConfirmDialog.close === "function") {
          backupConfirmDialog.close();
        } else {
          backupConfirmDialog.removeAttribute("open");
        }
      }

      function toggleDeleteControls() {
        state.showDeleteControls = !state.showDeleteControls;
        render();
      }

      function openDeleteSkillConfirm(skill) {
        state.pendingDelete = {
          id: skill.id,
          installPath: skill.installPath
        };
        deleteSkillMessage.textContent = "Uninstall " + skill.name + " from this computer?";
        deleteSkillPath.textContent = skill.installPath;
        statusLine.textContent = "Confirm skill uninstall";

        if (typeof deleteSkillDialog.showModal === "function") {
          deleteSkillDialog.showModal();
        } else {
          deleteSkillDialog.setAttribute("open", "");
        }
      }

      function closeDeleteSkillConfirm() {
        state.pendingDelete = null;
        deleteSkillPath.textContent = "-";
        if (deleteSkillDialog.open && typeof deleteSkillDialog.close === "function") {
          deleteSkillDialog.close();
        } else {
          deleteSkillDialog.removeAttribute("open");
        }
      }

      async function deleteLocalSkill(id, installPath) {
        statusLine.textContent = "Uninstalling skill...";
        const response = await fetch("/api/skills", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, installPath })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not uninstall skill";
          return;
        }

        state.skills = payload.skills || state.skills;
        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        closeDeleteSkillConfirm();
        statusLine.textContent = "Skill uninstalled. Backup kept.";
        render();
      }

      async function saveConfirmedSkill(id, installPath, install) {
        const command = String(install || "").trim();
        if (!command) {
          statusLine.textContent = "Enter an install command or GitHub skill URL before saving";
          backupCommandInput.focus();
          return;
        }

        statusLine.textContent = "Saving skill to backup...";
        const response = await fetch("/api/stack/skills", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, installPath, install: command })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not add skill to backup";
          backupCommandInput.focus();
          return;
        }

        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        closeBackupConfirm();
        statusLine.textContent = "Skill saved to backup";
        render();
      }

      async function addManualSource(install) {
        const command = String(install || "").trim();
        if (!command) {
          statusLine.textContent = "Enter an install command or GitHub skill URL";
          manualSourceInput.focus();
          return;
        }

        statusLine.textContent = "Saving skill source to backup...";
        const response = await fetch("/api/stack/skills/manual", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ install: command })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not save skill source";
          manualSourceInput.focus();
          return;
        }

        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        manualSourceInput.value = "";
        statusLine.textContent = "Skill source saved to backup";
        render();
      }

      async function removeStackSkill(id) {
        statusLine.textContent = "Removing skill from backup...";
        const response = await fetch("/api/stack/skills", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id })
        });

        if (!response.ok) {
          statusLine.textContent = "Could not remove skill";
          return;
        }

        const payload = await response.json();
        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        statusLine.textContent = "Skill removed from backup";
        render();
      }

      async function exportProfile() {
        statusLine.textContent = "Exporting profile...";
        const response = await fetch("/api/profile/export");
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not export profile";
          return;
        }

        profileExport.value = JSON.stringify(payload.profile || {}, null, 2);
        copyProfileButton.disabled = !profileExport.value.trim();
        statusLine.textContent = "Profile exported";
      }

      async function copyProfile() {
        const profileText = profileExport.value.trim();
        if (!profileText) {
          statusLine.textContent = "Export a profile before copying";
          return;
        }

        if (await copyTextWithFallback(profileText)) {
          statusLine.textContent = "Profile copied";
          return;
        }

        statusLine.textContent = "Could not copy profile";
      }

      async function previewProfileImport() {
        const profile = profileImportInput.value.trim();
        if (!profile) {
          statusLine.textContent = "Paste a profile before previewing";
          profileImportInput.focus();
          return;
        }

        statusLine.textContent = "Previewing profile import...";
        const response = await fetch("/api/profile/import/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          state.profileImportPreview = {
            items: [
              {
                id: "profile",
                status: "invalid",
                reason: payload.error || "Could not preview profile"
              }
            ],
            summary: { new: 0, existing: 0, updated: 0, invalid: 1 }
          };
          statusLine.textContent = payload.error || "Could not preview profile";
          renderProfileImportPreview();
          return;
        }

        state.profileImportPreview = payload.preview || null;
        statusLine.textContent = getProfileImportSummaryText(state.profileImportPreview);
        renderProfileImportPreview();
      }

      async function applyProfileImport() {
        const profile = profileImportInput.value.trim();
        if (!profile) {
          statusLine.textContent = "Paste a profile before applying";
          profileImportInput.focus();
          return;
        }

        applyProfileImportButton.disabled = true;
        statusLine.textContent = "Applying profile import...";
        const response = await fetch("/api/profile/import/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not apply profile";
          renderProfileImportPreview();
          return;
        }

        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        state.profileImportPreview = payload.preview || state.profileImportPreview;
        statusLine.textContent = "Profile imported into Backup";
        render();
      }

      function renderProfileImportPreview() {
        const preview = state.profileImportPreview;
        const applicableCount = getProfileApplicableCount(preview);
        applyProfileImportButton.disabled = applicableCount === 0;

        if (!preview) {
          profileImportSummary.textContent = "No profile preview yet";
          profileImportPreview.innerHTML = "";
          return;
        }

        profileImportSummary.textContent = getProfileImportSummaryText(preview);
        profileImportPreview.innerHTML = preview.items && preview.items.length
          ? preview.items.map(renderProfileImportItem).join("")
          : '<div class="stack-empty"><strong>No skills in profile</strong><span>This profile does not contain importable skills.</span></div>';
      }

      function renderProfileImportItem(item) {
        const status = String(item.status || "invalid");
        return [
          '<div class="profile-preview-row">',
          '<div class="skill-name">' + escapeHtml(item.id || "Invalid entry") + '</div>',
          '<span class="profile-status ' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>',
          '<div class="profile-help">' + escapeHtml(getProfileImportItemMessage(item)) + '</div>',
          '</div>'
        ].join("");
      }

      function getProfileImportItemMessage(item) {
        if (item.reason) return item.reason;
        if (item.status === "new") return "Will be added to Backup.";
        if (item.status === "updated") return "Will replace the saved restore source.";
        if (item.status === "existing") return "Already saved with the same restore source.";
        return "This profile entry cannot be imported.";
      }

      function getProfileImportSummaryText(preview) {
        if (!preview || !preview.summary) return "No profile preview yet";
        const summary = preview.summary;
        const applicableCount = getProfileApplicableCount(preview);
        return applicableCount + " to import / " + Number(summary.existing || 0) + " unchanged / " + Number(summary.invalid || 0) + " invalid";
      }

      function getProfileApplicableCount(preview) {
        if (!preview || !preview.summary) return 0;
        return Number(preview.summary.new || 0) + Number(preview.summary.updated || 0);
      }

      async function createStackFile() {
        statusLine.textContent = "Creating backup file...";
        const response = await fetch("/api/stack/create", { method: "POST" });

        if (!response.ok) {
          statusLine.textContent = "Could not create stack file";
          return;
        }

        const payload = await response.json();
        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        statusLine.textContent = "Backup file is ready";
        render();
      }

      async function chooseStackFileWithDialog() {
        statusLine.textContent = "Opening file picker...";
        const response = await fetch("/api/stack/choose-file", { method: "POST" });
        const payload = await response.json().catch(() => ({}));

        if (payload.canceled) {
          statusLine.textContent = "No backup file selected";
          return;
        }

        if (!response.ok) {
          statusLine.textContent = "File picker unavailable. Enter a path instead.";
          showStackPathForm();
          return;
        }

        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        stackPathForm.hidden = true;
        statusLine.textContent = "Backup file path updated";
        render();
      }

      async function setStackPath(path) {
        const nextPath = String(path || "").trim();

        if (!nextPath) {
          statusLine.textContent = "Enter a backup file path";
          stackPathInput.focus();
          return;
        }

        statusLine.textContent = "Updating backup file path...";
        const response = await fetch("/api/stack/path", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: nextPath })
        });

        if (!response.ok) {
          statusLine.textContent = "Could not update backup file path";
          return;
        }

        const payload = await response.json();
        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        stackPathForm.hidden = true;
        statusLine.textContent = "Backup file path updated";
        render();
      }

      async function revealStackFileLocation() {
        if (!state.stackFile.exists) {
          statusLine.textContent = "Create the backup file before opening it";
          return;
        }

        statusLine.textContent = "Opening backup file location...";
        const response = await fetch("/api/stack/reveal", { method: "POST" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not open backup file location";
          return;
        }

        state.stackFile = payload.stackFile || state.stackFile;
        render();
        statusLine.textContent = "Backup file location opened";
      }

      async function copyStackFilePath() {
        const path = state.stackFile.path || "";
        if (!path) {
          statusLine.textContent = "No backup file path to copy";
          return;
        }

        if (await copyTextWithFallback(path)) {
          statusLine.textContent = "Backup file path copied";
          return;
        }

        statusLine.textContent = "Could not copy backup file path";
      }

      function showStackPathForm() {
        stackPathForm.hidden = false;
        stackPathInput.value = state.stackFile.path || "";
        stackPathInput.focus();
      }

      async function copyInstallScriptText() {
        const script = installScript.value.trim();
        if (!script || copyInstallScript.disabled) return;

        if (await copyTextWithFallback(script)) {
          statusLine.textContent = "Install script copied";
          return;
        }

        statusLine.textContent = "Could not copy install script";
      }

      async function copyTextWithFallback(text) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch (error) {
          // Fall back to selecting the generated script when clipboard permission is restricted.
        }

        let textarea;
        try {
          textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          textarea.style.top = "0";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const copied = document.execCommand("copy");
          return copied;
        } catch (error) {
          return false;
        } finally {
          if (textarea) {
            textarea.remove();
          }
        }
      }

      async function startRestore(ids) {
        const installed = new Set(state.skills.map(installedSkillKey));
        const plan = getRestorePlan(installed);
        const restoreIds = Array.isArray(ids) ? ids : plan.installable.map((skill) => skill.id);
        if (restoreIds.length === 0) return;

        startRestoreButton.disabled = true;
        statusLine.textContent = "Restoring skills...";

        const response = await fetch("/api/restore/skills/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: restoreIds })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not restore skills";
          startRestoreButton.disabled = false;
          return;
        }

        state.restoreResults = payload.results || [];
        await loadSkills();
        statusLine.textContent = "Restore finished";
      }

      async function retryRestore(id) {
        await startRestore([id]);
      }

      function renderRestoreResults() {
        if (!state.restoreResults.length) {
          restoreResults.innerHTML = "";
          return;
        }

        const successes = state.restoreResults.filter((result) => result.status === "success").length;
        const failures = state.restoreResults.filter((result) => result.status === "failed").length;

        restoreResults.innerHTML = [
          '<div class="restore-results-summary">' + escapeHtml(successes) + " restored / " + escapeHtml(failures) + " failed</div>",
          '<div class="table-wrap"><table><thead><tr><th>Skill</th><th>Status</th><th>Message</th><th></th></tr></thead><tbody>',
          ...state.restoreResults.map((result) => [
            '<tr>',
            '<td data-label="Skill"><div class="skill-name">' + escapeHtml(result.id) + '</div></td>',
            '<td data-label="Status">' + escapeHtml(result.status) + '</td>',
            '<td data-label="Message"><span class="desc-preview">' + escapeHtml(result.message || "") + '</span>' + (result.detail ? '<div class="desc">' + escapeHtml(result.detail) + '</div>' : "") + '</td>',
            '<td data-label="Action">' + (result.status === "failed" ? '<button class="retry-restore" type="button" data-id="' + escapeHtml(result.id) + '">Retry</button>' : "") + '</td>',
            '</tr>'
          ].join("")),
          '</tbody></table></div>'
        ].join("");
      }

      async function runDiagnostics() {
        state.diagnostics.loading = true;
        runDiagnosticsButton.disabled = true;
        statusLine.textContent = "Running diagnostics...";
        renderDiagnostics();

        const response = await fetch("/api/diagnostics");
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          state.diagnostics = {
            checks: [
              {
                id: "diagnostics.request",
                label: "Diagnostics",
                status: "error",
                message: payload.error || "Could not run diagnostics."
              }
            ],
            summary: { ok: 0, warning: 0, error: 1 },
            loaded: true,
            loading: false
          };
          runDiagnosticsButton.disabled = false;
          statusLine.textContent = "Diagnostics failed";
          renderDiagnostics();
          return;
        }

        state.diagnostics = {
          checks: payload.checks || [],
          summary: payload.summary || { ok: 0, warning: 0, error: 0 },
          loaded: true,
          loading: false
        };
        runDiagnosticsButton.disabled = false;
        statusLine.textContent = getDiagnosticsSummaryText(state.diagnostics.summary);
        renderDiagnostics();
      }

      async function checkUpdates() {
        state.updates.loading = true;
        checkUpdatesButton.disabled = true;
        statusLine.textContent = "Checking saved skill updates...";
        renderUpdateResults();

        const response = await fetch("/api/check-updates", { method: "POST" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          state.updates = {
            items: [
              {
                id: "updates",
                status: "unknown",
                message: payload.error || "Could not check updates."
              }
            ],
            summary: { update_available: 0, up_to_date: 0, unknown: 1, not_installed: 0, needs_source: 0 },
            loaded: true,
            loading: false
          };
          checkUpdatesButton.disabled = false;
          statusLine.textContent = "Update check failed";
          renderUpdateResults();
          return;
        }

        state.updates = {
          items: payload.updates && payload.updates.items ? payload.updates.items : [],
          summary: payload.updates && payload.updates.summary ? payload.updates.summary : null,
          loaded: true,
          loading: false
        };
        checkUpdatesButton.disabled = false;
        statusLine.textContent = getUpdateSummaryText(state.updates.summary);
        renderUpdateResults();
      }

      function renderUpdateResults() {
        const updates = state.updates || { items: [], summary: null, loaded: false, loading: false };
        checkUpdatesButton.disabled = Boolean(updates.loading);

        if (updates.loading) {
          updateSummary.textContent = "Checking...";
          updateResults.innerHTML = '<div class="stack-empty"><strong>Checking updates</strong><span>Reading Backup and local installs.</span></div>';
          return;
        }

        if (!updates.loaded) {
          updateSummary.textContent = "Not checked yet";
          updateResults.innerHTML = '<div class="stack-empty"><strong>Updates not checked yet</strong><span>Run a check to review saved skills and refresh commands.</span></div>';
          return;
        }

        updateSummary.textContent = getUpdateSummaryText(updates.summary);
        updateResults.innerHTML = updates.items && updates.items.length
          ? updates.items.map(renderUpdateItem).join("")
          : '<div class="stack-empty"><strong>No saved skills</strong><span>Add skills to Backup before checking updates.</span></div>';
      }

      function renderUpdateItem(item) {
        const status = String(item.status || "unknown");
        const versions = [item.currentVersion, item.latestVersion].filter(Boolean).join(" -> ");
        const command = item.suggestedCommand
          ? '<code class="install-command">' + escapeHtml(item.suggestedCommand) + '</code>'
          : "";

        return [
          '<div class="update-row">',
          '<div class="skill-name">' + escapeHtml(item.id || "Skill") + '</div>',
          '<span class="update-status ' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>',
          '<div>',
          '<div class="diagnostic-message">' + escapeHtml(item.message || "") + '</div>',
          versions ? '<div class="diagnostic-detail">' + escapeHtml(versions) + '</div>' : "",
          command,
          '</div>',
          '</div>'
        ].join("");
      }

      function getUpdateSummaryText(summary) {
        if (!summary) return "Not checked yet";
        const available = Number(summary.update_available || 0);
        const unknown = Number(summary.unknown || 0);
        const missing = Number(summary.not_installed || 0);
        const needsSource = Number(summary.needs_source || 0);

        if (available > 0) {
          return available + " update" + (available === 1 ? "" : "s") + " available";
        }

        if (unknown > 0 || missing > 0 || needsSource > 0) {
          return unknown + " unknown / " + missing + " missing / " + needsSource + " needs source";
        }

        return Number(summary.up_to_date || 0) + " up to date";
      }

      function renderDiagnostics() {
        const diagnostics = state.diagnostics || { checks: [], summary: { ok: 0, warning: 0, error: 0 }, loaded: false, loading: false };
        runDiagnosticsButton.disabled = Boolean(diagnostics.loading);

        if (diagnostics.loading) {
          diagnosticsSummary.textContent = "Checking...";
          diagnosticsList.innerHTML = '<div class="stack-empty"><strong>Running diagnostics</strong><span>Checking local tools, network access, backup file, and skill roots.</span></div>';
          return;
        }

        if (!diagnostics.loaded) {
          diagnosticsSummary.textContent = "Not checked yet";
          diagnosticsList.innerHTML = '<div class="stack-empty"><strong>Diagnostics not run yet</strong><span>Run checks when restore fails or before moving a backup to another machine.</span></div>';
          return;
        }

        diagnosticsSummary.textContent = getDiagnosticsSummaryText(diagnostics.summary);
        diagnosticsList.innerHTML = diagnostics.checks.length
          ? diagnostics.checks.map(renderDiagnosticCheck).join("")
          : '<div class="stack-empty"><strong>No diagnostics returned</strong><span>Try running diagnostics again.</span></div>';
      }

      function renderDiagnosticCheck(check) {
        const status = String(check.status || "warning");
        return [
          '<div class="diagnostic-check ' + escapeHtml(status) + '">',
          '<div>',
          '<div class="diagnostic-label">' + escapeHtml(check.label || check.id || "Check") + '</div>',
          '<span class="diagnostic-status ' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>',
          '</div>',
          '<div>',
          '<div class="diagnostic-message">' + escapeHtml(check.message || "") + '</div>',
          check.detail ? '<div class="diagnostic-detail">' + escapeHtml(check.detail) + '</div>' : "",
          '</div>',
          '</div>'
        ].join("");
      }

      function getDiagnosticsSummaryText(summary) {
        const errors = Number(summary && summary.error ? summary.error : 0);
        const warnings = Number(summary && summary.warning ? summary.warning : 0);
        const ok = Number(summary && summary.ok ? summary.ok : 0);

        if (errors > 0) {
          return errors + " issue" + (errors === 1 ? "" : "s") + " found";
        }

        if (warnings > 0) {
          return warnings + " warning" + (warnings === 1 ? "" : "s");
        }

        return ok > 0 ? "All checks passed" : "Not checked yet";
      }

      async function saveManualInstallCommand(id, install) {
        const command = String(install || "").trim();
        if (!command) {
          statusLine.textContent = "Enter an install command or GitHub skill URL";
          return;
        }

        const response = await fetch("/api/stack/skills/source", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, install: command })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          statusLine.textContent = payload.error || "Could not save install command";
          return;
        }

        state.stack = payload.stack || state.stack;
        state.stackFile = payload.stackFile || state.stackFile;
        statusLine.textContent = "Install command saved";
        render();
      }

      function getInstalledSkillById() {
        const installedById = new Map();

        for (const skill of state.skills || []) {
          if (!installedById.has(skill.id)) {
            installedById.set(skill.id, skill);
          }
        }

        return installedById;
      }

      function installedSkillKey(skill) {
        return "skill:" + skill.id;
      }

      function stackSkillKey(skill) {
        return (skill.type || "skill") + ":" + skill.id;
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      refresh.addEventListener("click", loadSkills);
      showDeleteControlsButton.addEventListener("click", toggleDeleteControls);
      search.addEventListener("input", render);
      clearSearch.addEventListener("click", () => {
        search.value = "";
        render();
        search.focus();
      });
      viewTabs.forEach((tab) => {
        tab.addEventListener("click", () => activateView(tab.dataset.view));
      });
      copyInstallScript.addEventListener("click", copyInstallScriptText);
      startRestoreButton.addEventListener("click", () => startRestore());
      runDiagnosticsButton.addEventListener("click", runDiagnostics);
      checkUpdatesButton.addEventListener("click", checkUpdates);
      exportProfileButton.addEventListener("click", exportProfile);
      copyProfileButton.addEventListener("click", copyProfile);
      previewProfileImportButton.addEventListener("click", previewProfileImport);
      applyProfileImportButton.addEventListener("click", applyProfileImport);
      createStack.addEventListener("click", createStackFile);
      chooseStackFileButton.addEventListener("click", chooseStackFileWithDialog);
      revealStackFileButton.addEventListener("click", revealStackFileLocation);
      copyStackPathButton.addEventListener("click", copyStackFilePath);
      manualStackPath.addEventListener("click", () => {
        stackPathForm.hidden = !stackPathForm.hidden;
        if (!stackPathForm.hidden) {
          showStackPathForm();
        }
      });
      stackPathForm.addEventListener("submit", (event) => {
        event.preventDefault();
        setStackPath(stackPathInput.value);
      });
      manualSourceForm.addEventListener("submit", (event) => {
        event.preventDefault();
        addManualSource(manualSourceInput.value);
      });
      backupConfirmForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!state.pendingBackup) return;
        saveConfirmedSkill(state.pendingBackup.id, state.pendingBackup.installPath, backupCommandInput.value);
      });
      cancelBackupConfirm.addEventListener("click", closeBackupConfirm);
      backupConfirmDialog.addEventListener("cancel", () => {
        state.pendingBackup = null;
      });
      deleteSkillForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!state.pendingDelete) return;
        deleteLocalSkill(state.pendingDelete.id, state.pendingDelete.installPath);
      });
      cancelDeleteSkill.addEventListener("click", closeDeleteSkillConfirm);
      deleteSkillDialog.addEventListener("cancel", () => {
        state.pendingDelete = null;
      });
      list.addEventListener("click", (event) => {
        const backupButton = event.target.closest(".add-to-backup");
        if (backupButton && !backupButton.disabled) {
          resolveSkillBeforeBackup(backupButton.dataset.id, backupButton.dataset.installPath, backupButton);
          return;
        }

        const deleteButton = event.target.closest(".delete-local-skill");
        if (!deleteButton || deleteButton.disabled) return;
        openDeleteSkillConfirm({
          id: deleteButton.dataset.id,
          name: deleteButton.dataset.name,
          installPath: deleteButton.dataset.installPath
        });
      });
      backupList.addEventListener("click", (event) => {
        const button = event.target.closest(".remove-stack-skill");
        if (!button || button.disabled) return;
        removeStackSkill(button.dataset.id);
      });
      document.addEventListener("click", (event) => {
        const retryButton = event.target.closest(".retry-restore");
        if (!retryButton) return;
        retryRestore(retryButton.dataset.id);
      });
      document.addEventListener("submit", (event) => {
        const form = event.target.closest(".manual-command-form");
        if (!form) return;
        event.preventDefault();
        const input = form.querySelector(".manual-command-input");
        saveManualInstallCommand(form.dataset.id, input.value);
      });
      loadSkills();
    </script>
  </body>
</html>`;
}
