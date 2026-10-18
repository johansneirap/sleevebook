export type AccountField =
  | "name"
  | "handle"
  | "bio"
  | "whatsapp"
  | "instagram"
  | "email"
  | "preferredCurrency";

export interface AccountState {
  status: "idle" | "saved" | "error";
  message?: string;
  errors: Partial<Record<AccountField, string>>;
}

export const ACCOUNT_IDLE: AccountState = { status: "idle", errors: {} };
