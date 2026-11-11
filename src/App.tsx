import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import "./App.css";
import {
  Activity,
  Wifi,
  Battery,
  GripHorizontal,
  Settings,
  X,
  Minus,
  MemoryStick,
  Languages,
} from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import clsx from "clsx";
import { loadLanguage, STORAGE_KEY_LANGUAGE, TRANSLATIONS, Language } from "./i18n";
import {
  SystemMetrics,
  VisibleMetricsState,
  STORAGE_KEY_METRICS,
  formatBytes,
  formatSpeed,
  loadVisibleMetrics,
} from "./utils/metrics";

function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [visibleMetrics, setVisibleMetrics] = useState<VisibleMetricsState>(loadVisibleMetrics);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [autostart, setAutostart] = useState(false);

  const cardsWrapperRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const lastTargetHeightRef = useRef<number>(0);

  const t = TRANSLATIONS[language];

  // Persist visibility preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(visibleMetrics));
    } catch {
      // Ignore storage quota errors
    }
  }, [visibleMetrics]);

  // Persist and synchronize language with native tray menu
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LANGUAGE, language);
    } catch {
      // Ignore storage quota errors
    }
    invoke("set_tray_language", { lang: language }).catch(() => {});
  }, [language]);

  // Initialize autostart status
  useEffect(() => {
    isEnabled().then(setAutostart).catch(() => {});
  }, []);

  const handleToggleAutostart = async (checked: boolean) => {
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(checked);
    } catch (err) {
      console.error("Failed to toggle autostart:", err);
    }
  };

  // Window control handlers
  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (err) {
      console.error("Window minimize error", err);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().hide();
    } catch (err) {
      console.error("Window hide error", err);
    }
  };

  // Keyboard shortcut: Escape closes settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSettings(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dynamically resize window based on actual rendered DOM dimensions
  const syncWindowSize = useCallback(() => {
    const cardsHeight = cardsWrapperRef.current?.offsetHeight ?? 0;
    // 32px (title bar) + 16px (content pb) + 16px (footer) + 6px (border & safety buffer)
    const contentRequiredHeight = 70 + cardsHeight;

    let settingsRequiredHeight = 0;
    if (showSettings && settingsRef.current) {
      // 32px (top-8 offset) + settings overlay height + 8px bottom buffer
      settingsRequiredHeight = 40 + settingsRef.current.offsetHeight;
    }

    const targetHeight = Math.max(140, Math.ceil(Math.max(contentRequiredHeight, settingsRequiredHeight)));
    if (targetHeight !== lastTargetHeightRef.current) {
      lastTargetHeightRef.current = targetHeight;
      getCurrentWindow()
        .setSize(new LogicalSize(300, targetHeight))
        .catch(() => {});
    }
  }, [showSettings]);

  useLayoutEffect(() => {
    syncWindowSize();
  }, [syncWindowSize, visibleMetrics, metrics?.battery_available, language]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      syncWindowSize();
    });
    if (cardsWrapperRef.current) observer.observe(cardsWrapperRef.current);
    if (settingsRef.current) observer.observe(settingsRef.current);
    return () => observer.disconnect();
  }, [syncWindowSize, showSettings]);

  // Event-Driven Metrics Streaming with StrictMode-safe async cleanup
  useEffect(() => {
    let isCancelled = false;
    let unlisten: (() => void) | undefined;

    invoke<SystemMetrics>("get_metrics")
      .then((data) => {
        if (!isCancelled) setMetrics(data);
      })
      .catch((err) => console.error("Initial metrics fetch error", err));

    listen<SystemMetrics>("sys://metrics", (event) => {
      if (!isCancelled) {
        setMetrics(event.payload);
      }
    })
      .then((dispose) => {
        if (isCancelled) {
          dispose();
        } else {
          unlisten = dispose;
        }
      })
      .catch((err) => console.error("Listen metrics error", err));

    return () => {
      isCancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const batteryAvailable = Boolean(metrics?.battery_available);
  const hasAnyVisibleCard =
    visibleMetrics.cpu ||
    visibleMetrics.ram ||
    visibleMetrics.network ||
    (visibleMetrics.battery && batteryAvailable);

  return (
    <div className="app-container">
      {/* Title Bar / Drag Region separated from interactive buttons */}
      <div
        className="title-bar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Dedicated native drag spacer */}
        <div className="flex-1 h-full cursor-grab" data-tauri-drag-region />

        {/* Action buttons */}
        <div
          className={clsx(
            "flex items-center gap-1.5 transition-opacity duration-200 z-30",
            isHovered || showSettings ? "opacity-100" : "opacity-0"
          )}
        >
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-black/10 dark:hover:bg-white/10 text-[var(--md-sys-color-on-surface-variant)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--md-sys-color-primary)]"
            onClick={() => setLanguage((prev) => (prev === "en" ? "zh" : "en"))}
            title={t.tooltips.language}
            aria-label={t.tooltips.language}
          >
            <Languages size={13} />
            <span>{language === "en" ? "EN/中" : "中/EN"}</span>
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--md-sys-color-on-surface-variant)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--md-sys-color-primary)]"
            onClick={() => setShowSettings((prev) => !prev)}
            title={t.tooltips.settings}
            aria-label={t.tooltips.settings}
          >
            <Settings
              size={15}
              className={clsx("transition-transform duration-200", showSettings && "rotate-45")}
            />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--md-sys-color-on-surface-variant)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--md-sys-color-primary)]"
            onClick={handleMinimize}
            title={t.tooltips.minimize}
            aria-label={t.tooltips.minimize}
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-red-500/80 hover:text-white text-[var(--md-sys-color-on-surface-variant)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-red-500"
            onClick={handleClose}
            title={t.tooltips.close}
            aria-label={t.tooltips.close}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Click-outside backdrop when settings overlay is open */}
      {showSettings && (
        <div
          className="absolute inset-0 top-8 z-10"
          onClick={() => setShowSettings(false)}
          aria-hidden="true"
        />
      )}

      {/* Settings Overlay */}
      {showSettings && (
        <div
          ref={settingsRef}
          className="settings-overlay absolute inset-x-0 top-8 bg-[var(--md-sys-color-surface)] z-20 p-4 border-b border-[var(--md-sys-color-outline)]/20 shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">{t.settingsTitle}</h3>
            <button
              type="button"
              className="text-xs opacity-60 hover:opacity-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--md-sys-color-primary)] rounded px-1"
              onClick={() => setShowSettings(false)}
            >
              {t.done}
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={visibleMetrics.cpu}
                onChange={(e) => setVisibleMetrics({ ...visibleMetrics, cpu: e.target.checked })}
              />
              <span className="text-body text-sm">{t.cpuInfo}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={visibleMetrics.ram}
                onChange={(e) => setVisibleMetrics({ ...visibleMetrics, ram: e.target.checked })}
              />
              <span className="text-body text-sm">{t.memory}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={visibleMetrics.network}
                onChange={(e) => setVisibleMetrics({ ...visibleMetrics, network: e.target.checked })}
              />
              <span className="text-body text-sm">{t.networkSpeed}</span>
            </label>
            <label
              className={clsx(
                "flex items-center gap-2 select-none",
                batteryAvailable ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                type="checkbox"
                disabled={!batteryAvailable}
                checked={visibleMetrics.battery && batteryAvailable}
                onChange={(e) =>
                  setVisibleMetrics({ ...visibleMetrics, battery: e.target.checked })
                }
              />
              <span className="text-body text-sm">{t.battery}</span>
              {!batteryAvailable && (
                <span className="text-xs opacity-70">{t.unavailable}</span>
              )}
            </label>
            <div className="pt-2 mt-0.5 border-t border-[var(--md-sys-color-outline)]/20">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autostart}
                  onChange={(e) => handleToggleAutostart(e.target.checked)}
                />
                <span className="text-body text-sm">{t.launchOnStartup}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="content">
        <div ref={cardsWrapperRef} className="flex flex-col gap-3">
          {/* CPU Monitor */}
          {visibleMetrics.cpu && (
            <div className="card-metric">
              <Activity size={24} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-label">{t.cpuUsage}</div>
                <div className="text-headline tabular-nums">
                  {metrics ? Math.round(metrics.cpu_usage) : 0}%
                </div>
              </div>
            </div>
          )}

          {/* RAM Monitor */}
          {visibleMetrics.ram && (
            <div className="card-metric">
              <MemoryStick size={24} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-label">{t.memory}</div>
                <div className="text-headline tabular-nums">
                  {metrics && metrics.total_memory > 0
                    ? Math.round((metrics.used_memory / metrics.total_memory) * 100)
                    : 0}
                  %
                  <span className="text-body text-[var(--md-sys-color-on-surface-variant)] ml-2 text-xs font-mono tabular-nums">
                    {metrics ? formatBytes(metrics.used_memory, true) : "0.0 GB"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Network Monitor */}
          {visibleMetrics.network && (
            <div className="card-metric">
              <Wifi size={24} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-label">{t.network}</div>
                <div className="text-body flex justify-between text-xs font-mono tabular-nums">
                  <span>↓ {formatSpeed(metrics?.rx_speed ?? 0)}</span>
                  <span className="opacity-60">↑ {formatSpeed(metrics?.tx_speed ?? 0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Battery Monitor */}
          {visibleMetrics.battery && batteryAvailable && (
            <div className="card-metric">
              <Battery size={24} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-label">
                  {t.battery} {metrics?.is_charging ? t.charging : ""}
                </div>
                <div className="text-headline tabular-nums">{metrics?.battery_level ?? 0}%</div>
              </div>
            </div>
          )}

          {/* Empty state when all metrics are disabled */}
          {!hasAnyVisibleCard && (
            <div className="py-4 text-center text-xs opacity-50 select-none">
              {t.allHidden}
            </div>
          )}
        </div>
      </div>

      {/* Footer / Drag Handle */}
      <div
        className="h-4 w-full flex justify-center items-center opacity-30 hover:opacity-60 transition-opacity cursor-grab"
        data-tauri-drag-region
      >
        <GripHorizontal size={14} />
      </div>
    </div>
  );
}

export default App;
