// Scanner styles (design brief v2 "Estante"). Mobile first: one column that
// stacks camera, then reading, then history. From 880px the camera card sits
// on the left and the results on the right. --accent marks the guide frame,
// the primary action and the best match; everything else is neutral cards.
export const SCANNER_CSS = `
.sb-scan-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 16px 112px;
  box-sizing: border-box;
  color: var(--ink);
}
.sb-scan-head {
  display: grid;
  gap: 6px;
}
.sb-scan-title {
  margin: 0;
  font-size: 26px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.sb-scan-lead {
  margin: 0;
  max-width: 560px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--muted);
}
.sb-scan-link {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}
.sb-scan-link:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}
.sb-scan-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  margin-top: 20px;
}
.sb-scan-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  padding: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  box-sizing: border-box;
  min-width: 0;
}
.sb-scan-eyebrow {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.sb-scan-stage {
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  aspect-ratio: 3 / 4;
  max-height: 62vh;
  background: var(--ink);
  border-radius: var(--radius);
  box-sizing: border-box;
}
.sb-scan-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sb-scan-dim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.sb-scan-guide {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  height: 70%;
  aspect-ratio: 63 / 88;
  max-width: 84%;
  box-shadow: 0 0 0 999px rgba(27, 32, 51, 0.5);
  pointer-events: none;
}
.sb-scan-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border-color: var(--accent);
  border-style: solid;
  border-width: 0;
}
.sb-scan-corner[data-pos="tl"] { top: -2px; left: -2px; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 10px; }
.sb-scan-corner[data-pos="tr"] { top: -2px; right: -2px; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 10px; }
.sb-scan-corner[data-pos="bl"] { bottom: -2px; left: -2px; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 10px; }
.sb-scan-corner[data-pos="br"] { bottom: -2px; right: -2px; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 10px; }
.sb-scan-status {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 12px;
  width: max-content;
  max-width: calc(100% - 24px);
  box-sizing: border-box;
  border-radius: 999px;
  background: rgba(27, 32, 51, 0.72);
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
}
.sb-scan-centered {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
}
.sb-scan-centered p {
  margin: 0;
  color: #ffffff;
  font-size: 15px;
  line-height: 1.5;
}
.sb-scan-actions {
  display: grid;
  gap: 10px;
  max-width: 420px;
  width: 100%;
  margin: 0 auto;
}
.sb-scan-capture,
.sb-scan-btn,
.sb-scan-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 14px;
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 180ms var(--ease-out-expo), border-color 180ms var(--ease-out-expo), color 180ms var(--ease-out-expo);
}
.sb-scan-capture {
  min-height: 56px;
  border: 0;
  background: var(--accent);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
}
.sb-scan-capture:hover:not(:disabled) {
  background: var(--accent-strong);
}
.sb-scan-capture:disabled {
  background: var(--surface-2);
  color: var(--muted);
  cursor: default;
}
.sb-scan-btn,
.sb-scan-upload {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
}
.sb-scan-btn:hover:not(:disabled),
.sb-scan-upload:hover {
  background: var(--surface-2);
}
.sb-scan-btn:disabled {
  color: var(--muted);
  cursor: default;
}
.sb-scan-btn-primary {
  border: 0;
  background: var(--accent);
  color: #ffffff;
}
.sb-scan-btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}
.sb-scan-btn-primary:disabled {
  background: var(--surface-2);
  color: var(--muted);
}
.sb-scan-btn-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--accent);
}
.sb-scan-btn-ghost:hover:not(:disabled) {
  background: var(--accent-soft);
}
.sb-scan-upload:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.sb-scan-upload input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.sb-scan-help {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}
.sb-scan-side {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-content: start;
  min-width: 0;
}
.sb-scan-title-small {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.sb-scan-reading {
  margin: 0;
  font-size: clamp(20px, 3.4vw, 24px);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.sb-scan-progress {
  position: relative;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--accent-soft);
}
.sb-scan-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--accent);
  border-radius: 999px;
  animation: sb-scan-sweep 1.6s var(--ease-out-expo) infinite;
  transform: translateX(-100%);
}
@keyframes sb-scan-sweep {
  to { transform: translateX(100%); }
}
.sb-scan-candidates {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.sb-scan-candidate {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-sizing: border-box;
}
.sb-scan-candidate[data-best="true"] {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}
.sb-scan-candidate-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.sb-scan-meta {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--muted);
}
.sb-scan-chip {
  display: inline-flex;
  align-items: center;
  width: max-content;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 0 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}
.sb-scan-chip[data-tone="accent"] {
  background: var(--accent-soft);
  color: var(--accent-strong);
}
.sb-scan-chip[data-tone="success"] {
  background: var(--success-soft);
  color: var(--success);
}
.sb-scan-chip[data-tone="warning"] {
  background: var(--warning-soft);
  color: var(--warning);
}
.sb-scan-candidate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}
.sb-scan-place {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  box-sizing: border-box;
}
.sb-scan-place label {
  flex: 1 1 180px;
  display: grid;
  gap: 4px;
}
.sb-scan-place select {
  width: 100%;
  min-height: 44px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 8px 10px;
  font-family: var(--font-ui);
  font-size: 14px;
  box-sizing: border-box;
}
.sb-scan-history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.sb-scan-history li {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-size: 14px;
  color: var(--ink);
}
.sb-scan-history .sb-scan-meta {
  margin: 0;
}
.sb-scan-error {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
}
.sb-scan-notice {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 14px;
  line-height: 1.5;
  font-weight: 500;
}
.sb-scan-tips {
  margin: 0;
  padding: 0 0 0 18px;
  display: grid;
  gap: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
}
.sb-scan-error-inline {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--danger);
}
@media (min-width: 880px) {
  .sb-scan-layout {
    grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
    align-items: start;
    gap: 28px;
  }
  .sb-scan-stage {
    max-height: none;
    max-width: none;
    margin: 0;
  }
  .sb-scan-actions {
    max-width: none;
    margin: 0;
  }
}
@media (max-width: 879px) {
  .sb-scan-layout[data-phase="result"] .sb-scan-camera,
  .sb-scan-layout[data-phase="reading"] .sb-scan-camera {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sb-scan-progress::after {
    animation: none;
    transform: none;
    opacity: 0.5;
  }
  .sb-scan-capture,
  .sb-scan-btn,
  .sb-scan-upload {
    transition: none;
  }
}
`;
