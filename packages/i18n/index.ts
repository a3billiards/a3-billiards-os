export { useTranslation } from "react-i18next";

export {
  changeLanguage,
  getCurrentLanguage,
  initI18n,
  i18n,
  isRTL,
} from "./i18n";

// Backward-compatible exports still used by existing code.
export * from "./src/index";

