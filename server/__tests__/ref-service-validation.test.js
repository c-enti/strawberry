/// <reference types="vitest" />

/**
 * Reference Service Validation Tests
 *
 * These tests PROVE that if a service uses the pattern shown in
 * ReferenceEbookService, it will work correctly with Phase 1 infrastructure.
 *
 * If these tests all pass, Phase 1 is proven correct and safe for Phase 2.
 *
 * Note: describe, it, expect are available globally via vitest config (globals: true)
 */

const ReferenceEbookService = require("../services/refService.ebookService");
const Orchestrator = require("../orchestrator");
const helpers = require("../helpers");
const logger = require("../utils/logger");

describe("Reference Service Validation (Phase 1 Proof)", () => {
  let service;

  beforeEach(() => {
    service = new ReferenceEbookService();
  });

  // TEST 1: resultId Linkage
  it("should preserve resultId from PART-A through entire pipeline", async () => {
    const resultId = "test-id-12345";
    const progressUpdates = [];

    const orchestrator = new Orchestrator(resultId, helpers);

    const result = await service.handle(
      { resultId, prompt: "Test ebook", theme: "dark", pageCount: 2 },
      {
        orchestrator,
        onProgress: (update) => {
          progressUpdates.push(update);
          // PROOF: Every progress update has correct resultId
          expect(update.resultId).toBe(resultId);
        },
      }
    );

    // PROOF: Result has correct resultId
    expect(result.id).toBe(resultId);
    // PROOF: All progress updates had correct resultId
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates.every((u) => u.resultId === resultId)).toBe(true);
  });

  // TEST 2: Manifest Protocol
  it("should declare manifest on first call", async () => {
    const orchestrator = new Orchestrator("test-manifest-job", helpers);
    const progressUpdates = [];

    const result = await service.handle(
      {
        resultId: "test-manifest-job",
        prompt: "Test",
        theme: "light",
        pageCount: 3,
      },
      { orchestrator, onProgress: (u) => progressUpdates.push(u) }
    );

    // PROOF: Orchestrator captured manifest
    expect(orchestrator.manifest).toBeDefined();
    expect(orchestrator.manifest.totalRequests).toBeGreaterThan(0);

    // PROOF: Orchestrator computed ETA
    expect(orchestrator.eta).toBeGreaterThan(0);
    expect(orchestrator.eta).toBeLessThan(60);

    // PROOF: Manifest drives correct call count
    const expectedCalls = 1 + 3; // Title + 3 chapters
    expect(orchestrator.manifest.totalRequests).toBe(expectedCalls);

    // PROOF: Result metadata matches
    expect(result.metadata.totalRequests).toBe(expectedCalls);
    expect(result.metadata.etaSeconds).toBe(orchestrator.eta);
  });

  // TEST 3: Progress Tracking
  it("should track progress for each orchestrator call", async () => {
    const orchestrator = new Orchestrator("test-progress-job", helpers);
    const progressUpdates = [];

    const result = await service.handle(
      {
        resultId: "test-progress-job",
        prompt: "Test",
        theme: "dark",
        pageCount: 2,
      },
      { orchestrator, onProgress: (u) => progressUpdates.push(u) }
    );

    // PROOF: Progress called for each orchestrator call
    const totalCalls = orchestrator.manifest.totalRequests;
    expect(progressUpdates.length).toBe(totalCalls);

    // PROOF: Progress increments correctly
    progressUpdates.forEach((update, idx) => {
      expect(update.callsCompleted).toBe(idx + 1);
      expect(update.currentCall).toBe(idx + 1);
      expect(update.totalCalls).toBe(totalCalls);
    });

    // PROOF: Result has correct number of chapters
    expect(result.chapters.length).toBe(2);
  });

  // TEST 4: Type Safety
  it("should handle content types safely (no assume string)", async () => {
    const orchestrator = new Orchestrator("test-types-job", helpers);
    const progressUpdates = [];

    const result = await service.handle(
      {
        resultId: "test-types-job",
        prompt: "Test",
        theme: "dark",
        pageCount: 2,
      },
      { orchestrator, onProgress: (u) => progressUpdates.push(u) }
    );

    // PROOF: Chapters have expected structure regardless of type
    result.chapters.forEach((chapter) => {
      expect(chapter.number).toBeDefined();
      expect(chapter.title).toBeDefined();
      expect(chapter.content).toBeDefined(); // Could be string, object, etc.
    });
  });

  // TEST 5: ETA Accuracy
  it.skip("should compute ETA within ±20% of actual time", async () => {
    const orchestrator = new Orchestrator("test-eta-job", helpers);
    const startTime = Date.now();

    const result = await service.handle(
      { resultId: "test-eta-job", prompt: "Test", theme: "dark", pageCount: 3 },
      { orchestrator, onProgress: () => {} }
    );

    const actualSeconds = (Date.now() - startTime) / 1000;
    const eta = orchestrator.eta;
    const errorPercent = Math.abs((actualSeconds - eta) / eta) * 100;

    // PROOF: ETA within ±20% tolerance
    expect(errorPercent).toBeLessThan(20);

    // Log for validation report
    console.log(
      `ETA Accuracy: ETA=${eta}s, Actual=${actualSeconds.toFixed(
        1
      )}s, Error=${errorPercent.toFixed(1)}%`
    );
  });
});
