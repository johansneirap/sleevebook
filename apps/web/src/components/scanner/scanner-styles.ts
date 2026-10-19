// Scanner styles. Mobile first: one column that stacks camera, then reading,
// then history. From 880px the camera sits on the left, results on the right.
// Foil is used only for the guide corners and the primary action.
export const SCANNER_CSS = `
.sb-scan-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 56px 16px 112px;
  box-sizing: border-box;
}
.sb-scan-layout {
  display: grid;
  gap: 28px;
  margin-top: 28px;
}
.sb-scan-stage {
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  aspect-ratio: 3 / 4;
  max-height: 62vh;
  background: var(--leather-deep);
  border: 1px solid var(--rule);
  border-radius: 4px;
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
  box-shadow: 0 0 0 999px rgba(12, 10, 9, 0.62);
  pointer-events: none;
}
.sb-scan-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border-color: var(--foil);
  border-style: solid;
  border-width: 0;
}
.sb-scan-corner[data-pos="tl"] { top: -1px; left: -1px; border-top-width: 1.5px; border-left-width: 1.5px; }
.sb-scan-corner[data-pos="tr"] { top: -1px; right: -1px; border-top-width: 1.5px; border-right-width: 1.5px; }
.sb-scan-corner[data-pos="bl"] { bottom: -1px; left: -1px; border-bottom-width: 1.5px; border-left-width: 1.5px; }
.sb-scan-corner[data-pos="br"] { bottom: -1px; right: -1px; border-bottom-width: 1.5px; border-right-width: 1.5px; }
.sb-scan-status {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  margin: 0;
  text-align: center;
  font-family: var(--font-ui);
  font-size: 12px;
  letter-spacing: 0.14em;
  font-variant-caps: all-small-caps;
  color: var(--linen);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
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
  color: var(--linen);
  font-family: var(--font-ui);
  font-size: 15px;
  line-height: 1.5;
}
.sb-scan-actions {
  display: grid;
  gap: 12px;
  max-width: 420px;
  width: 100%;
  margin: 18px auto 0;
}
.sb-scan-capture {
  min-height: 56px;
  border: 0;
  border-radius: 2px;
  background: var(--foil);
  color: var(--velvet);
  font-family: var(--font-ui);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.16em;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 280ms var(--ease-out-expo);
}
.sb-scan-capture:disabled {
  background: var(--leather);
  color: var(--smoke);
  cursor: default;
}
.sb-scan-capture:hover:not(:disabled) {
  background: color-mix(in srgb, var(--foil) 86%, var(--linen));
}
.sb-scan-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px 18px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  color: var(--linen);
  font-family: var(--font-ui);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.14em;
  font-size: 13px;
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 240ms var(--ease-out-expo), color 240ms var(--ease-out-expo);
}
.sb-scan-upload:hover,
.sb-scan-upload:focus-within {
  border-color: var(--foil);
  color: var(--foil);
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
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--smoke);
  text-align: center;
}
.sb-scan-side {
  display: grid;
  gap: 24px;
  align-content: start;
  min-width: 0;
}
.sb-scan-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  background: var(--velvet-raised);
  border: 1px solid color-mix(in srgb, var(--linen) 10%, transparent);
  border-radius: 4px;
}
.sb-scan-reading {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(24px, 4vw, 30px);
  line-height: 1.15;
  color: var(--linen);
  overflow-wrap: anywhere;
}
.sb-scan-progress {
  position: relative;
  height: 1px;
  overflow: hidden;
  background: var(--rule);
}
.sb-scan-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--smoke);
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
  gap: 14px;
}
.sb-scan-candidate {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--linen) 10%, transparent);
  border-radius: 4px;
  background: var(--velvet);
}
.sb-scan-candidate[data-best="true"] {
  border-color: var(--rule);
}
.sb-scan-candidate-name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 1.1;
  color: var(--linen);
  overflow-wrap: anywhere;
}
.sb-scan-meta {
  margin: 4px 0 0;
  font-family: var(--font-ui);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: var(--smoke);
}
.sb-scan-candidate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 12px;
  align-items: center;
}
.sb-scan-text-button {
  padding: 6px 0;
  border: 0;
  background: none;
  color: var(--smoke);
  font-family: var(--font-ui);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.12em;
  font-size: 12px;
  cursor: pointer;
  transition: color 240ms var(--ease-out-expo);
}
.sb-scan-text-button:hover:not(:disabled),
.sb-scan-text-button:focus-visible {
  color: var(--linen);
}
.sb-scan-text-button:disabled {
  cursor: default;
  color: var(--foil-dim);
}
.sb-scan-link {
  color: var(--foil);
  font-family: var(--font-ui);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.12em;
  font-size: 12px;
}
.sb-scan-place {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
  width: 100%;
}
.sb-scan-place select {
  flex: 1 1 180px;
  min-height: 40px;
  background: var(--velvet-raised);
  color: var(--linen);
  border: 1px solid var(--rule);
  border-radius: 2px;
  padding: 8px 10px;
  font-family: var(--font-ui);
  font-size: 14px;
}
.sb-scan-history {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--rule);
}
.sb-scan-history li {
  display: grid;
  gap: 2px;
  padding: 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--linen) 10%, transparent);
  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--linen);
}
.sb-scan-history .sb-scan-meta {
  margin: 0;
}
.sb-scan-error {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  color: var(--linen);
}
.sb-scan-error[data-tone="warn"] {
  color: var(--foil);
}
.sb-scan-tips {
  margin: 0;
  padding: 0 0 0 18px;
  display: grid;
  gap: 8px;
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  color: var(--smoke);
}
@media (min-width: 880px) {
  .sb-scan-layout {
    grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
    align-items: start;
    gap: 40px;
  }
  .sb-scan-stage {
    max-height: none;
    max-width: 380px;
    margin: 0;
  }
  .sb-scan-actions {
    margin: 18px 0 0;
  }
  .sb-scan-upload-prominent {
    min-height: 56px;
    font-size: 14px;
    border-color: var(--foil-dim);
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
  .sb-scan-upload,
  .sb-scan-text-button {
    transition: none;
  }
}
`;
