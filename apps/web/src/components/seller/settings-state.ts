export type SettingsField = "mode" | "currency" | "whatsapp" | "instagram" | "email";

export interface SettingsState {
  status: "idle" | "saved" | "error";
  message?: string;
  errors: Partial<Record<SettingsField, string>>;
}

export const SETTINGS_IDLE: SettingsState = { status: "idle", errors: {} };
