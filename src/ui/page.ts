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
        --ink: #19201d;
        --muted: #68736e;
        --line: #d8ddd9;
        --panel: #f6f7f2;
        --paper: #fffdf7;
        --accent: #186f65;
        --accent-2: #b6472a;
        --shadow: 0 18px 48px rgba(25, 32, 29, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: var(--ink);
        background:
          linear-gradient(90deg, rgba(24, 111, 101, 0.04) 1px, transparent 1px),
          linear-gradient(rgba(24, 111, 101, 0.04) 1px, transparent 1px),
          var(--paper);
        background-size: 28px 28px;
        font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
      }

      button,
      input,
      textarea {
        font: inherit;
      }

      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
      }

      .rail {
        min-width: 0;
        border-right: 1px solid var(--line);
        background: rgba(246, 247, 242, 0.92);
        padding: 28px 24px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 36px;
      }

      .mark {
        width: 34px;
        height: 34px;
        border: 2px solid var(--ink);
        background: var(--accent);
        box-shadow: 5px 5px 0 var(--ink);
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
      }

      .caption {
        margin-top: 5px;
        color: var(--muted);
        font-size: 13px;
      }

      .metric {
        border-top: 1px solid var(--line);
        padding: 20px 0;
      }

      .metric strong {
        display: block;
        font-size: 44px;
        line-height: 1;
      }

      .metric span {
        color: var(--muted);
        font-size: 14px;
      }

      .stack-file {
        border-top: 1px solid var(--line);
        padding-top: 18px;
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
        background: rgba(255, 253, 247, 0.86);
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
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }

      .toolbar h2 {
        font-size: clamp(28px, 4vw, 56px);
        line-height: 0.95;
        min-width: 0;
        max-width: 720px;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .search {
        min-width: min(320px, 100%);
        border: 1px solid var(--line);
        background: rgba(255, 253, 247, 0.86);
        padding: 11px 13px;
        outline: none;
      }

      .search:focus {
        border-color: var(--accent);
      }

      .button {
        border: 1px solid var(--ink);
        background: var(--ink);
        color: var(--paper);
        padding: 11px 14px;
        cursor: pointer;
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

      .stack-panel {
        margin-bottom: 28px;
        padding-bottom: 26px;
        border-bottom: 1px solid var(--line);
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
        background: rgba(255, 253, 247, 0.9);
        border: 1px solid var(--line);
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
        padding: 15px 18px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }

      th {
        font-size: 12px;
        text-transform: uppercase;
        color: var(--muted);
        background: var(--panel);
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .skill-name {
        font-weight: 700;
        font-size: 18px;
      }

      .desc {
        color: var(--muted);
        max-width: 420px;
      }

      .desc-popover {
        display: block;
        width: 100%;
        max-width: 420px;
        border: 0;
        padding: 0;
        color: inherit;
        background: transparent;
        text-align: left;
        cursor: help;
      }

      .desc-popover:focus {
        outline: 2px solid rgba(24, 111, 101, 0.38);
        outline-offset: 4px;
      }

      .desc-preview {
        display: inline;
        color: var(--muted);
        border-bottom: 1px dashed rgba(104, 115, 110, 0.55);
        line-height: 1.35;
      }

      .desc-full {
        display: none;
        margin-top: 9px;
        padding: 10px 12px;
        color: var(--ink);
        background: var(--panel);
        border-left: 3px solid var(--accent);
        line-height: 1.45;
        box-shadow: 0 10px 24px rgba(25, 32, 29, 0.08);
      }

      .desc-popover:hover .desc-full,
      .desc-popover:focus .desc-full,
      .desc-popover:focus-within .desc-full {
        display: block;
      }

      .location-badge {
        display: inline-flex;
        align-items: center;
        min-width: 82px;
        justify-content: center;
        border: 1px solid var(--line);
        background: var(--panel);
        padding: 5px 8px;
        font-size: 13px;
        color: var(--ink);
      }

      .stack-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 78px;
        border: 1px solid rgba(24, 111, 101, 0.28);
        background: rgba(24, 111, 101, 0.08);
        padding: 5px 8px;
        font-size: 13px;
        color: var(--accent);
      }

      .stack-status.missing {
        border-color: rgba(182, 71, 42, 0.3);
        background: rgba(182, 71, 42, 0.08);
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
        background: rgba(255, 253, 247, 0.9);
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
        background: rgba(255, 253, 247, 0.92);
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

      .manual-command-form {
        display: grid;
        gap: 8px;
        margin-top: 10px;
        max-width: 420px;
      }

      .manual-command-input {
        border: 1px solid var(--line);
        background: rgba(255, 253, 247, 0.92);
        padding: 9px 10px;
        outline: none;
      }

      .manual-command-input:focus {
        border-color: var(--accent);
      }

      .backup-confirm-dialog {
        width: min(640px, calc(100vw - 32px));
        border: 1px solid var(--ink);
        padding: 0;
        color: var(--ink);
        background: var(--paper);
        box-shadow: var(--shadow);
      }

      .backup-confirm-dialog::backdrop {
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
        background: rgba(255, 253, 247, 0.92);
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
      .retry-restore {
        min-width: 78px;
        border: 1px solid var(--ink);
        background: transparent;
        color: var(--ink);
        padding: 8px 10px;
        cursor: pointer;
      }

      .add-to-backup:hover:not(:disabled),
      .remove-stack-skill:hover:not(:disabled),
      .retry-restore:hover:not(:disabled) {
        color: var(--paper);
        background: var(--accent);
        border-color: var(--accent);
      }

      .add-to-backup:disabled {
        cursor: default;
        color: var(--accent);
        background: rgba(24, 111, 101, 0.08);
        border-color: rgba(24, 111, 101, 0.28);
      }

      .remove-stack-skill:hover:not(:disabled) {
        background: var(--accent-2);
        border-color: var(--accent-2);
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
        background: rgba(255, 253, 247, 0.9);
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
          border-right: 0;
          border-bottom: 1px solid var(--line);
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

        .restore-preview-grid,
        .install-script-box {
          grid-template-columns: 1fr;
        }

        .restore-preview-list {
          grid-template-columns: 1fr;
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
        <div class="metric">
          <strong id="skill-count">-</strong>
          <span>installed skills found</span>
        </div>
        <div class="metric">
          <strong id="root-count">-</strong>
          <span>source roots represented</span>
        </div>
        <div class="metric">
          <strong id="stack-count">-</strong>
          <span>skills in backup</span>
        </div>
        <div class="stack-file">
          <div class="stack-file-label">Current backup file</div>
          <code id="stack-file-path">-</code>
          <p id="stack-file-state" class="stack-file-state">Checking backup file...</p>
          <div class="stack-file-actions">
            <button id="create-stack" class="button" type="button">Create backup file</button>
            <button id="choose-stack-file" class="button secondary" type="button">Choose backup file...</button>
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
          <h2>My Skills</h2>
          <div class="actions">
            <input id="search" class="search" type="search" placeholder="Filter skills" autocomplete="off" />
            <button id="refresh" class="button" type="button">Refresh</button>
          </div>
        </div>
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
              <textarea id="install-script" class="install-script" readonly spellcheck="false"></textarea>
              <div class="restore-actions">
                <button id="start-restore" class="button" type="button" disabled>Start restore</button>
                <button id="copy-install-script" class="button secondary" type="button" disabled>Copy install script</button>
                <span class="advanced-option">Advanced option</span>
              </div>
            </div>
          </div>
          <div id="restore-results" class="restore-results" aria-live="polite"></div>
        </section>
        <p id="status-line" class="status-line">Scanning local skill directories...</p>
        <section id="skill-list" aria-live="polite"></section>
      </main>
    </div>
    <dialog id="backup-confirm-dialog" class="backup-confirm-dialog" aria-labelledby="backup-confirm-heading">
      <form id="backup-confirm-form" class="backup-confirm-form">
        <h3 id="backup-confirm-heading">Confirm backup command</h3>
        <p id="backup-confirm-message" class="backup-confirm-message">Review the install command before this skill is saved.</p>
        <label class="backup-command-label" for="backup-command-input">
          Install command
          <input id="backup-command-input" class="backup-command-input" type="text" autocomplete="off" placeholder="npx skills add https://github.com/owner/repo --skill skill-name" />
        </label>
        <p id="backup-command-help" class="backup-command-help">This backup needs an install command before it can be saved.</p>
        <div class="dialog-actions">
          <button id="cancel-backup-confirm" class="button secondary" type="button">Cancel</button>
          <button id="confirm-backup-save" class="button" type="submit">Save to backup</button>
        </div>
      </form>
    </dialog>
    <script>
      const state = {
        skills: [],
        stack: { skills: [] },
        stackFile: { path: "", exists: false },
        restoreResults: [],
        pendingBackup: null
      };
      const list = document.querySelector("#skill-list");
      const backupList = document.querySelector("#backup-list");
      const stackSummary = document.querySelector("#stack-summary");
      const restorePreviewSummary = document.querySelector("#restore-preview-summary");
      const restorePreviewList = document.querySelector("#restore-preview-list");
      const restoreResults = document.querySelector("#restore-results");
      const installScript = document.querySelector("#install-script");
      const copyInstallScript = document.querySelector("#copy-install-script");
      const startRestoreButton = document.querySelector("#start-restore");
      const statusLine = document.querySelector("#status-line");
      const search = document.querySelector("#search");
      const refresh = document.querySelector("#refresh");
      const skillCount = document.querySelector("#skill-count");
      const rootCount = document.querySelector("#root-count");
      const stackCount = document.querySelector("#stack-count");
      const stackFilePath = document.querySelector("#stack-file-path");
      const stackFileState = document.querySelector("#stack-file-state");
      const createStack = document.querySelector("#create-stack");
      const chooseStackFileButton = document.querySelector("#choose-stack-file");
      const manualStackPath = document.querySelector("#manual-stack-path");
      const stackPathForm = document.querySelector("#stack-path-form");
      const stackPathInput = document.querySelector("#stack-path-input");
      const backupConfirmDialog = document.querySelector("#backup-confirm-dialog");
      const backupConfirmForm = document.querySelector("#backup-confirm-form");
      const backupConfirmMessage = document.querySelector("#backup-confirm-message");
      const backupCommandInput = document.querySelector("#backup-command-input");
      const backupCommandHelp = document.querySelector("#backup-command-help");
      const cancelBackupConfirm = document.querySelector("#cancel-backup-confirm");

      async function loadSkills() {
        statusLine.textContent = "Scanning local skill directories...";
        list.innerHTML = "";

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
        }
      }

      function render() {
        const query = search.value.trim().toLowerCase();
        const saved = new Set(state.stack.skills.map(stackSkillKey));
        const installed = new Set(state.skills.map(installedSkillKey));
        const installedById = getInstalledSkillById();
        const filtered = state.skills.filter((skill) => {
          return [skill.name, skill.description, skill.installPath, skill.sourceRoot, skill.location && skill.location.label]
            .join(" ")
            .toLowerCase()
            .includes(query);
        });

        const roots = new Set(state.skills.map((skill) => skill.sourceRoot));
        skillCount.textContent = String(state.skills.length);
        rootCount.textContent = String(roots.size);
        stackCount.textContent = String(state.stack.skills.length);
        renderStackFile();
        renderBackupContents(installed, installedById);
        renderRestorePreview(installed);
        statusLine.textContent = query
          ? filtered.length + " of " + state.skills.length + " skills match"
          : state.skills.length + " installed skills found";

        if (filtered.length === 0) {
          list.innerHTML = '<div class="empty">No installed skills matched the current view.</div>';
          return;
        }

        list.innerHTML = [
          '<div class="table-wrap">',
          '<table>',
          '<thead><tr><th>Name</th><th>Description</th><th>Location</th><th>Install path</th><th>Backup</th></tr></thead>',
          '<tbody>',
          ...filtered.map((skill) => {
            const isSaved = saved.has(stackSkillKey(skill));
            return [
            '<tr>',
            '<td><div class="skill-name">' + escapeHtml(skill.name) + '</div></td>',
            '<td class="desc">' + renderDescription(skill.description) + '</td>',
            '<td>' + renderLocation(skill) + '</td>',
            '<td><code>' + escapeHtml(skill.installPath) + '</code></td>',
            '<td><button class="add-to-backup" type="button" data-id="' + escapeHtml(skill.id) + '" data-install-path="' + escapeHtml(skill.installPath) + '"' + (isSaved ? ' disabled' : '') + '>' + (isSaved ? 'In backup' : 'Add to backup') + '</button></td>',
            '</tr>'
          ].join("");
          }),
          '</tbody>',
          '</table>',
          '</div>'
        ].join("");
      }

      function renderBackupContents(installed, installedById) {
        const stackSkills = state.stack.skills || [];
        const installedCount = stackSkills.filter((skill) => installed.has(installedSkillKey(skill))).length;
        stackSummary.textContent = stackSkills.length
          ? installedCount + " installed / " + stackSkills.length + " in backup"
          : "0 in backup";

        if (stackSkills.length === 0) {
          backupList.innerHTML = '<div class="stack-empty">No skills in this backup yet.</div>';
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
              '<td><div class="skill-name">' + escapeHtml(currentSkill ? currentSkill.name : skill.id) + '</div></td>',
              '<td>' + renderStackStatus(isInstalled) + '</td>',
              '<td>' + renderRestoreSource(skill) + renderManualCommandForm(skill) + '</td>',
              '<td>' + renderStackLocation(currentSkill) + '</td>',
              '<td><button class="remove-stack-skill" type="button" data-id="' + escapeHtml(skill.id) + '">Remove</button></td>',
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
          '<input class="manual-command-input" type="text" autocomplete="off" placeholder="npx skills add https://github.com/owner/repo --skill ' + escapeHtml(skill.id) + '" />',
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
          '<button class="desc-popover" type="button" title="Hover or focus to show full description">',
          '<span class="desc-preview">' + escapeHtml(preview) + '</span>',
          '<span class="desc-full" role="tooltip">' + escapeHtml(fullDescription) + '</span>',
          '</button>'
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
          backupCommandHelp.textContent = pendingBackup.reason || "Paste a npx skills add command before this skill can be saved.";
        }

        statusLine.textContent = pendingBackup.command
          ? "Review install command before saving"
          : "Enter an install command before saving";

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

      async function saveConfirmedSkill(id, installPath, install) {
        const command = String(install || "").trim();
        if (!command) {
          statusLine.textContent = "Enter an install command before saving";
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

        try {
          installScript.focus();
          installScript.select();
          const copied = document.execCommand("copy");
          installScript.setSelectionRange(0, 0);
          return copied;
        } catch (error) {
          return false;
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
            '<td><div class="skill-name">' + escapeHtml(result.id) + '</div></td>',
            '<td>' + escapeHtml(result.status) + '</td>',
            '<td><span class="desc-preview">' + escapeHtml(result.message || "") + '</span>' + (result.detail ? '<div class="desc">' + escapeHtml(result.detail) + '</div>' : "") + '</td>',
            '<td>' + (result.status === "failed" ? '<button class="retry-restore" type="button" data-id="' + escapeHtml(result.id) + '">Retry</button>' : "") + '</td>',
            '</tr>'
          ].join("")),
          '</tbody></table></div>'
        ].join("");
      }

      async function saveManualInstallCommand(id, install) {
        const command = String(install || "").trim();
        if (!command) {
          statusLine.textContent = "Enter an install command";
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
      search.addEventListener("input", render);
      copyInstallScript.addEventListener("click", copyInstallScriptText);
      startRestoreButton.addEventListener("click", () => startRestore());
      createStack.addEventListener("click", createStackFile);
      chooseStackFileButton.addEventListener("click", chooseStackFileWithDialog);
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
      backupConfirmForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!state.pendingBackup) return;
        saveConfirmedSkill(state.pendingBackup.id, state.pendingBackup.installPath, backupCommandInput.value);
      });
      cancelBackupConfirm.addEventListener("click", closeBackupConfirm);
      backupConfirmDialog.addEventListener("cancel", () => {
        state.pendingBackup = null;
      });
      list.addEventListener("click", (event) => {
        const button = event.target.closest(".add-to-backup");
        if (!button || button.disabled) return;
        resolveSkillBeforeBackup(button.dataset.id, button.dataset.installPath, button);
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
