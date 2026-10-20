// Shared styles for the seller-mode buyer UI (tray and contact links), v2 "Estante".
export const SELLER_CSS = `
.sp-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font: 600 14px/1 var(--font-ui);
  text-decoration: none;
  cursor: pointer;
  transition: background-color 180ms var(--ease-out-expo), border-color 180ms var(--ease-out-expo);
}
.sp-link:hover {
  background: var(--surface-2);
}
.sp-link:disabled {
  opacity: 0.5;
  cursor: default;
}
.sp-link:disabled:hover {
  background: var(--surface);
}
.sp-link-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}
.sp-link-primary:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}
.sp-link-primary:disabled:hover {
  background: var(--accent);
}
.sp-link-ghost {
  min-height: 44px;
  padding: 0 10px;
  border: 0;
  background: none;
  color: var(--accent);
}
.sp-link-ghost:hover {
  background: var(--accent-soft);
}
.sp-icon {
  flex: none;
}
`;
