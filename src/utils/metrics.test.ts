import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatSpeed,
  parseVisibleMetrics,
  DEFAULT_METRICS_VISIBILITY,
} from "./metrics";

describe("formatBytes", () => {
  it("clamps invalid, negative, and sub-byte inputs to 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-512)).toBe("0 B");
    expect(formatBytes(0.5)).toBe("0 B");
    expect(formatBytes(0.99)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
  });

  it("formats standard byte magnitudes accurately", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 2)).toBe("2 MB");
    expect(formatBytes(8 * 1024 * 1024 * 1024, true)).toBe("8.0 GB");
  });
});

describe("formatSpeed", () => {
  it("appends /s unit to formatted throughput", () => {
    expect(formatSpeed(0)).toBe("0 B/s");
    expect(formatSpeed(0.25)).toBe("0 B/s");
    expect(formatSpeed(2048)).toBe("2 KB/s");
  });
});

describe("parseVisibleMetrics", () => {
  it("returns defaults for null, empty, or malformed JSON", () => {
    expect(parseVisibleMetrics(null)).toEqual(DEFAULT_METRICS_VISIBILITY);
    expect(parseVisibleMetrics("")).toEqual(DEFAULT_METRICS_VISIBILITY);
    expect(parseVisibleMetrics("{bad-json")).toEqual(DEFAULT_METRICS_VISIBILITY);
    expect(parseVisibleMetrics("null")).toEqual(DEFAULT_METRICS_VISIBILITY);
    expect(parseVisibleMetrics("[]")).toEqual(DEFAULT_METRICS_VISIBILITY);
    expect(parseVisibleMetrics('"string"')).toEqual(DEFAULT_METRICS_VISIBILITY);
  });

  it("preserves valid booleans and safely defaults missing or wrong-typed fields", () => {
    expect(parseVisibleMetrics('{"cpu": false}')).toEqual({
      cpu: false,
      ram: true,
      network: true,
      battery: true,
    });

    expect(parseVisibleMetrics('{"cpu": "false", "ram": 0, "network": false}')).toEqual({
      cpu: true,
      ram: true,
      network: false,
      battery: true,
    });
  });
});
