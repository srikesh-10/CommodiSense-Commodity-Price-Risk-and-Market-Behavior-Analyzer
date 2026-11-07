import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, relevantSections, toRequest, validateConfig } from "./analysis-config";

describe("analysis config", () => {
  it("defaults to 3 clusters and 3 hidden states", () => {
    expect(DEFAULT_CONFIG.nClusters).toBe(3);
    expect(DEFAULT_CONFIG.hmmStates).toBe(3);
  });
  it("risk objective hides clustering and HMM settings", () => {
    expect(relevantSections("risk")).toEqual({ clustering: false, hmm: false, risk: true });
  });
  it("rejects a period longer than available coverage", () => {
    const errs = validateConfig({ ...DEFAULT_CONFIG, period: "5y" }, [
      { commodity: "gold", start: "2024-01-01", end: "2025-01-01", observations: 250 },
      { commodity: "oil", start: "2024-01-01", end: "2025-01-01", observations: 250 },
    ]);
    expect(errs.length).toBe(2);
  });
  it("PCA with 3 components needs 3 features", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, pcaComponents: 3, features: ["log_return", "momentum_20"] })).toContain("PCA needs at least 3 features selected.");
  });
  it("balanced sensitivity sends 95% VaR", () => {
    expect(toRequest({ ...DEFAULT_CONFIG, objective: "risk" }).risk?.var_confidence).toBe(0.95);
  });
});
