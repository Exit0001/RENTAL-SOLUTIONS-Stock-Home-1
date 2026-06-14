import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "@/locales/en/common.json";
import enNav from "@/locales/en/nav.json";
import enAuth from "@/locales/en/auth.json";
import enHome from "@/locales/en/home.json";
import enStock from "@/locales/en/stock.json";
import enJobs from "@/locales/en/jobs.json";
import enFinance from "@/locales/en/finance.json";
import enHistory from "@/locales/en/history.json";
import enSettings from "@/locales/en/settings.json";
import enModals from "@/locales/en/modals.json";

import thCommon from "@/locales/th/common.json";
import thNav from "@/locales/th/nav.json";
import thAuth from "@/locales/th/auth.json";
import thHome from "@/locales/th/home.json";
import thStock from "@/locales/th/stock.json";
import thJobs from "@/locales/th/jobs.json";
import thFinance from "@/locales/th/finance.json";
import thHistory from "@/locales/th/history.json";
import thSettings from "@/locales/th/settings.json";
import thModals from "@/locales/th/modals.json";

export const STORAGE_KEY = "stak-language";
export type Language = "en" | "th";

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return "th";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" || saved === "th" ? saved : "th";
};

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, nav: enNav, auth: enAuth, home: enHome, stock: enStock, jobs: enJobs, finance: enFinance, history: enHistory, settings: enSettings, modals: enModals },
    th: { common: thCommon, nav: thNav, auth: thAuth, home: thHome, stock: thStock, jobs: thJobs, finance: thFinance, history: thHistory, settings: thSettings, modals: thModals },
  },
  ns: ["common", "nav", "auth", "home", "stock", "jobs", "finance", "history", "settings", "modals"],
  defaultNS: "common",
  lng: getInitialLanguage(),
  fallbackLng: "th",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18n;
