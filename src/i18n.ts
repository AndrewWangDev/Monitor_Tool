export type Language = "en" | "zh";

export const STORAGE_KEY_LANGUAGE = "toolkit_language";

export interface TranslationDictionary {
  cpuUsage: string;
  memory: string;
  network: string;
  battery: string;
  charging: string;
  allHidden: string;
  settingsTitle: string;
  done: string;
  cpuInfo: string;
  networkSpeed: string;
  unavailable: string;
  launchOnStartup: string;
  languageLabel: string;
  tooltips: {
    language: string;
    settings: string;
    minimize: string;
    close: string;
  };
  errorTitle: string;
  errorRetry: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    cpuUsage: "CPU Usage",
    memory: "Memory",
    network: "Network",
    battery: "Battery",
    charging: "(Charging)",
    allHidden: "All monitors hidden. Open settings to enable.",
    settingsTitle: "Display Metrics",
    done: "Done",
    cpuInfo: "CPU Info",
    networkSpeed: "Network Speed",
    unavailable: "(Unavailable)",
    launchOnStartup: "Launch on Startup",
    languageLabel: "EN",
    tooltips: {
      language: "Switch to 中文",
      settings: "Settings",
      minimize: "Minimize",
      close: "Hide to Tray",
    },
    errorTitle: "Unexpected rendering error",
    errorRetry: "Reload",
  },
  zh: {
    cpuUsage: "CPU 占用",
    memory: "内存占用",
    network: "网络速率",
    battery: "电池电量",
    charging: "(充电中)",
    allHidden: "所有监控指标已隐藏，请在设置中开启。",
    settingsTitle: "监控显示设置",
    done: "完成",
    cpuInfo: "处理器占用",
    networkSpeed: "实时网速",
    unavailable: "(无电池)",
    launchOnStartup: "开机自动启动",
    languageLabel: "中",
    tooltips: {
      language: "Switch to English",
      settings: "设置",
      minimize: "最小化",
      close: "隐藏到托盘",
    },
    errorTitle: "界面渲染异常",
    errorRetry: "重新加载",
  },
};

export function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    if (saved === "en" || saved === "zh") {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }

  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh")) {
    return "zh";
  }
  return "en";
}
