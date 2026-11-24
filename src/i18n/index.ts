import { ka, type MessageKey } from "./ka";

const dictionaries = { ka } as const;
export type Locale = keyof typeof dictionaries;
export const defaultLocale: Locale = "ka";

export function t(key: MessageKey, vars?: Record<string, string | number>, locale: Locale = defaultLocale) {
  let s: string = dictionaries[locale][key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export type { MessageKey };
