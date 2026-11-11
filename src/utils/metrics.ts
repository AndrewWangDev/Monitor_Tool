export interface SystemMetrics {
  cpu_usage: number;
  total_memory: number;
  used_memory: number;
  total_rx: number;
  total_tx: number;
  rx_speed: number;
  tx_speed: number;
  battery_available: boolean;
  battery_level: number;
  is_charging: boolean;
}

export interface VisibleMetricsState {
  cpu: boolean;
  ram: boolean;
  network: boolean;
  battery: boolean;
}

export const STORAGE_KEY_METRICS = "toolkit_visible_metrics";

export const DEFAULT_METRICS_VISIBILITY: VisibleMetricsState = {
  cpu: true,
  ram: true,
  network: true,
  battery: true,
};

/**
 * Formats byte count safely into a human-readable string.
 * Guards against NaN, negative values, and sub-byte logarithmic underflows.
 */
export const formatBytes = (bytes: number, fixedDecimal = false): string => {
  if (!Number.isFinite(bytes) || bytes < 1) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1));
  const value = bytes / Math.pow(k, i);
  const formatted = fixedDecimal && i > 0 ? value.toFixed(1) : String(parseFloat(value.toFixed(1)));
  return `${formatted} ${sizes[i]}`;
};

export const formatSpeed = (bytes: number): string => `${formatBytes(bytes)}/s`;

/**
 * Safely parses and validates persisted visibility flags from a JSON string or storage.
 * Falls back cleanly per-field on malformed, legacy, or corrupted values.
 */
export function parseVisibleMetrics(raw: string | null): VisibleMetricsState {
  if (!raw) return { ...DEFAULT_METRICS_VISIBILITY };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_METRICS_VISIBILITY };
    }
    const record = parsed as Record<string, unknown>;
    return {
      cpu: typeof record.cpu === "boolean" ? record.cpu : DEFAULT_METRICS_VISIBILITY.cpu,
      ram: typeof record.ram === "boolean" ? record.ram : DEFAULT_METRICS_VISIBILITY.ram,
      network:
        typeof record.network === "boolean" ? record.network : DEFAULT_METRICS_VISIBILITY.network,
      battery:
        typeof record.battery === "boolean" ? record.battery : DEFAULT_METRICS_VISIBILITY.battery,
    };
  } catch {
    return { ...DEFAULT_METRICS_VISIBILITY };
  }
}

export function loadVisibleMetrics(): VisibleMetricsState {
  try {
    return parseVisibleMetrics(localStorage.getItem(STORAGE_KEY_METRICS));
  } catch {
    return { ...DEFAULT_METRICS_VISIBILITY };
  }
}
