// Shared styles for the seller-mode buyer UI (tray and contact links).
export const SELLER_CSS = `
.sp-link {
  color: var(--linen);
  text-decoration: none;
  font-size: 12px;
  padding: 4px 0;
  border: 0;
  border-bottom: 1px solid var(--rule);
  background: none;
  cursor: pointer;
  transition: color 240ms var(--ease-out-expo), border-color 240ms var(--ease-out-expo);
}
.sp-link:hover,
.sp-link:focus-visible {
  color: var(--foil);
  border-color: var(--foil);
}
.sp-link:focus-visible {
  outline: 1px solid var(--foil);
  outline-offset: 4px;
}
.sp-link:disabled {
  opacity: 0.4;
  cursor: default;
}
.sp-link:disabled:hover {
  color: var(--linen);
  border-color: var(--rule);
}
`;
