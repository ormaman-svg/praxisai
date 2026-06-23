import { useLang } from "./context";
import { translations, type TranslationKeys } from "./translations";

export function useT(): TranslationKeys {
  const { lang } = useLang();
  return translations[lang];
}
