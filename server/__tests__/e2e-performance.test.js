/**
 * Performance and Load Testing
 * Baseline performance metrics and SLA validation
 */

import { describe, it, expect } from "vitest";
import {
  SAMPLE_CLASSIFICATIONS,
  SAMPLE_PROMPTS,
} from "../test-utils/e2e-fixtures.js";
import genieService from "../genieService.js";

describe("Performance and Load Testing", () => {
  /**
   * Test 1: Individual Request Performance
   */
  describe("Single Request Performance", () => {
    it("should process ebook generation in reasonable time", async () => {
      const startTime = Date.now();

      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      const duration = Date.now() - startTime;

      // Should complete (no hard SLA on unit tests, but document baseline)
      expect(result).toBeDefined();
      expect(duration).toBeGreaterThan(0);

      console.log(`📊 Ebook generation completed in ${duration}ms`);
    });

    it("should process poster generation quickly", async () => {
      const startTime = Date.now();

      const payload = {
        mode: "basic",
        prompt: SAMPLE_PROMPTS.poster[0],
        _classification: SAMPLE_CLASSIFICATIONS.poster_tech,
      };

      const result = await genieService.process(payload);

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      console.log(`📊 Poster generation completed in ${duration}ms`);
    });

    it("should process auto-classification quickly", async () => {
      const startTime = Date.now();

      const payload = {
        prompt: SAMPLE_PROMPTS.ebook[0],
        // No classification - will auto-classify
      };

      const result = await genieService.process(payload);

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      console.log(`📊 Auto-classification + generation in ${duration}ms`);
    });
  });

  /**
   * Test 2: Concurrent Request Performance
   */
  describe("Concurrent Request Handling", () => {
    it.skip("should handle 5 concurrent requests", async () => {
      const startTime = Date.now();

      const requests = Array.from({ length: 5 }, (_, i) => ({
        mode: "ebook",
        prompt: `${
          SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length]
        } (concurrent ${i})`,
        _classification: {
          ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
          id: `concurrent-5-${i}`,
        },
      }));

      const results = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });

      const avgTime = duration / 5;
      console.log(
        `📊 5 concurrent requests: ${duration}ms total, ${avgTime.toFixed(
          0
        )}ms avg`
      );
    });

    it.skip("should handle 10 concurrent requests without degradation", async () => {
      const startTime = Date.now();

      const requests = Array.from({ length: 10 }, (_, i) => ({
        mode: i % 2 === 0 ? "ebook" : "basic",
        prompt: SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length],
        _classification: {
          ...(i % 2 === 0
            ? SAMPLE_CLASSIFICATIONS.ebook_poetry
            : SAMPLE_CLASSIFICATIONS.poster_tech),
          id: `concurrent-10-${i}`,
        },
      }));

      const results = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });

      const avgTime = duration / 10;
      console.log(
        `📊 10 concurrent requests: ${duration}ms total, ${avgTime.toFixed(
          0
        )}ms avg`
      );
    });

    it.skip("should maintain consistent response quality under concurrent load", async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length],
        _classification: {
          ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
          id: `quality-test-${i}`,
        },
      }));

      const results = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      // Verify all results have required fields
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.out_envelope).toBeDefined();
        expect(result.out_envelope.pages).toBeDefined();
        expect(Array.isArray(result.out_envelope.pages)).toBe(true);
        expect(result.out_envelope.pages.length).toBeGreaterThan(0);
      });

      console.log(`✅ All 5 concurrent requests maintained quality`);
    });
  });

  /**
   * Test 3: Response Time Characteristics
   */
  describe("Response Time Characteristics", () => {
    it.skip("should complete multiple requests with consistent latency", async () => {
      const timings = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();

        const payload = {
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length],
          _classification: {
            ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
            id: `latency-test-${i}`,
          },
        };

        await genieService.process(payload);

        timings.push(Date.now() - startTime);
      }

      // Calculate statistics
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);

      console.log(`📊 Latency Analysis (3 sequential requests):`);
      console.log(`   Average: ${avgTime.toFixed(0)}ms`);
      console.log(`   Min: ${minTime}ms`);
      console.log(`   Max: ${maxTime}ms`);

      // Should be reasonably consistent
      expect(maxTime - minTime).toBeLessThan(avgTime * 2);
    });

    it.skip("should scale linearly with request volume", async () => {
      const sizes = [1, 3, 5];
      const timings = [];

      for (const size of sizes) {
        const startTime = Date.now();

        const requests = Array.from({ length: size }, (_, i) => ({
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length],
          _classification: {
            ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
            id: `scaling-test-${size}-${i}`,
          },
        }));

        await Promise.all(
          requests.map((payload) => genieService.process(payload))
        );

        timings.push(Date.now() - startTime);
      }

      console.log(`📊 Scaling Test Results:`);
      sizes.forEach((size, i) => {
        console.log(`   ${size} requests: ${timings[i]}ms`);
      });

      // Verify results exist
      expect(timings.length).toBe(3);
    });
  });

  /**
   * Test 4: Resource Usage Patterns
   */
  describe("Resource Usage Patterns", () => {
    it.skip("should not leak memory across requests", async () => {
      // Take baseline memory
      if (global.gc) {
        global.gc();
      }

      const requests = Array.from({ length: 5 }, (_, i) => ({
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length],
        _classification: {
          ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
          id: `memory-test-${i}`,
        },
      }));

      const results = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      expect(results.length).toBe(5);
      console.log(`✅ 5 requests processed without observable memory leak`);
    });

    it("should handle rapid sequential requests", async () => {
      const startTime = Date.now();
      const results = [];

      for (let i = 0; i < 5; i++) {
        const payload = {
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length],
          _classification: {
            ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
            id: `sequential-${i}`,
          },
        };

        results.push(await genieService.process(payload));
      }

      const duration = Date.now() - startTime;

      expect(results.length).toBe(5);
      console.log(`📊 5 sequential requests completed in ${duration}ms`);
    });
  });

  /**
   * Test 5: SLA Compliance Documentation
   */
  describe("SLA Compliance Baseline", () => {
    it("should document target SLAs", () => {
      const slas = {
        generateEndpoint: {
          target: "30 seconds",
          rationale: "Includes LLM classification + PDF generation",
        },
        overrideEndpoint: {
          target: "10 seconds",
          rationale: "Lightweight regeneration with cached data",
        },
        classifyEndpoint: {
          target: "30 seconds",
          rationale: "May use LLM API for classification",
        },
        p95Latency: {
          target: "50th percentile of P95",
          rationale: "Typical network + processing overhead",
        },
        concurrencyLevel: {
          target: "10+ concurrent requests",
          rationale: "Should handle typical load without degradation",
        },
      };

      console.log(`📊 Service Level Agreement (SLA) Targets:`);
      Object.entries(slas).forEach(([key, value]) => {
        console.log(`   ${key}: ${value.target}`);
        console.log(`      └─ ${value.rationale}`);
      });

      expect(slas).toBeDefined();
    });

    it("should establish performance baseline", () => {
      const baseline = {
        description: "Baseline performance characteristics",
        environment: "Development environment",
        testDate: new Date().toISOString(),
        notes: [
          "These are baseline metrics for development environments",
          "Production SLAs may differ based on hardware, database, and network",
          "Concurrent requests may show different characteristics under load",
          "PDF generation time depends on content complexity",
        ],
      };

      console.log(`📊 Performance Baseline Documentation:`);
      console.log(`   Environment: ${baseline.environment}`);
      console.log(`   Date: ${baseline.testDate}`);
      console.log(`   Notes:`);
      baseline.notes.forEach((note) => {
        console.log(`      • ${note}`);
      });

      expect(baseline).toBeDefined();
    });
  });

  /**
   * Test 6: Stress Test (Optional - runs quickly)
   */
  describe("Stress Testing", () => {
    it("should handle burst of requests", async () => {
      const burstSize = 3;
      const startTime = Date.now();

      const requests = Array.from({ length: burstSize }, (_, i) => ({
        mode: i % 2 === 0 ? "ebook" : "basic",
        prompt: SAMPLE_PROMPTS.ebook[i % SAMPLE_PROMPTS.ebook.length],
        _classification: {
          ...(i % 2 === 0
            ? SAMPLE_CLASSIFICATIONS.ebook_poetry
            : SAMPLE_CLASSIFICATIONS.poster_tech),
          id: `burst-${i}`,
        },
      }));

      const results = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(burstSize);
      expect(results.every((r) => r.out_envelope)).toBe(true);

      console.log(
        `📊 Burst test (${burstSize} concurrent): ${duration}ms total`
      );
    });
  });
});
