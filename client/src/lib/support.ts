export function getSupportTelegramUrl(): string {
  const value = String(import.meta.env.VITE_SUPPORT_TELEGRAM_URL ?? "").trim();
  return value || "https://t.me/your_support_handle";
}

