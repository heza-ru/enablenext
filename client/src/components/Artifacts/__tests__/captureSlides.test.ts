import { computeCaptureTimeout, chunk, EARLY_PHASE_TIMEOUT_MS } from '../DownloadArtifact';

describe('computeCaptureTimeout', () => {
  it('returns the base allowance for a small deck', () => {
    // base 10_000 + 3_000/slide, so 5 slides = 10_000 + 15_000 = 25_000
    expect(computeCaptureTimeout(5)).toBe(25_000);
  });

  it('scales linearly with slide count', () => {
    expect(computeCaptureTimeout(40)).toBe(10_000 + 40 * 3_000); // 130_000
  });

  it('caps at the absolute maximum (5 minutes) for extreme deck sizes', () => {
    expect(computeCaptureTimeout(1000)).toBe(300_000);
  });
});

describe('chunk', () => {
  it('splits an array into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single group if size >= array length', () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('returns an empty array for an empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('computeCaptureTimeout — regression for the large-deck bug', () => {
  it('exceeds the old fixed 40-second ceiling for a 40-slide deck', () => {
    // The bug this fixes: the old code used a flat 40_000ms regardless of
    // slide count, which a 40-slide deck (or larger) would always exceed.
    expect(computeCaptureTimeout(40)).toBeGreaterThan(40_000);
  });
});

describe('EARLY_PHASE_TIMEOUT_MS', () => {
  // This covers the "waiting for html2canvas to load from the CDN" phase of
  // captureSlides(), before slide count is known and the scaled per-slide
  // timeout (computeCaptureTimeout) can take over. It exists precisely
  // because a hung (not failed) <script> load never fires onerror, so
  // without a ceiling here the whole export would wait forever.
  it('is a fixed, positive value', () => {
    expect(EARLY_PHASE_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('is short enough to not be mistaken for the scaled per-slide ceiling', () => {
    // It should sit below the timeout computeCaptureTimeout would produce
    // for even a small deck — it's a startup-phase guard, not a capture-time
    // budget, so it must not creep up to (or past) that scale.
    expect(EARLY_PHASE_TIMEOUT_MS).toBeLessThan(computeCaptureTimeout(5));
  });

  it('is long enough to cover a real (non-hung) CDN script load', () => {
    // A few seconds is plausible for a slow connection; anything under ~5s
    // risks false-positive timeouts on a real but slow network fetch.
    expect(EARLY_PHASE_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
  });

  it('is well below the absolute 5-minute capture ceiling', () => {
    expect(EARLY_PHASE_TIMEOUT_MS).toBeLessThan(computeCaptureTimeout(1000));
  });
});
