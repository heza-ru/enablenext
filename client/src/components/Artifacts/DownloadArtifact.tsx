import React, { useState, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { CircleCheckBig, Loader2, Download, ChevronDown } from 'lucide-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { Artifact } from '~/common';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@librechat/client';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { useCodeState } from '~/Providers/EditorContext';
import { apiBaseUrl } from 'librechat-data-provider';
import { useEditArtifact, useGetStartupConfig } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import { useDeckAutosaveQueue } from './useDeckAutosaveQueue';

const LOG = '[DownloadArtifact]';

/**
 * Encodes binary data (font files relayed for the artifact-asset-fetch-request
 * handler below) as base64 for transport over postMessage, which is JSON-only
 * and can't carry an ArrayBuffer directly. The browser has no built-in
 * Buffer, hence the btoa(String.fromCharCode(...)) pattern -- fine for the
 * small (a few hundred KB at most) font files this is used for; a chunked
 * variant would be needed for anything large enough to blow the call-stack
 * limit on `apply`/spread.
 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

type NativeFormat = {
  label: string;
  ext: string;
  triggerFn: string;
  /**
   * Optional load-bearing script-tag hint. Unlike `triggerFn` (which may be a
   * documentation comment the LLM can drop without breaking the artifact),
   * this is a `<script src="...">` the artifact needs to render at all, so
   * its presence is a much more reliable signal of format support.
   */
  libHint?: string;
};

export const NATIVE_FORMATS: NativeFormat[] = [
  { label: 'PPTX', ext: 'pptx', triggerFn: 'downloadPptx', libHint: '/libs/deck-renderer.js' },
  { label: 'XLSX', ext: 'xlsx', triggerFn: 'downloadExcel' },
  { label: 'DOCX', ext: 'docx', triggerFn: 'downloadDocx', libHint: '/libs/doc-renderer.js' },
];

export function detectNativeFormats(content: string): NativeFormat[] {
  return NATIVE_FORMATS.filter(
    (f) => content.includes(f.triggerFn) || (f.libHint != null && content.includes(f.libHint)),
  );
}

/**
 * Sniffs sheet names out of an excel-creator artifact's source text, the same
 * way detectNativeFormats sniffs format capability — by pattern-matching the
 * source string, since nothing structured is available before the artifact
 * actually runs (see excel-creator.skill.md's `const SHEETS = [...]`
 * convention). Narrowed to the `SHEETS = [...]` block specifically (rather
 * than matching `name:` anywhere in the whole artifact) to avoid false
 * positives from unrelated `name:` fields elsewhere in the source.
 *
 * Never throws — an unparseable/absent SHEETS block just yields []. Callers
 * fail open to "download all sheets" when this returns [] or a single name,
 * per the design's never-block-a-download requirement.
 */
export function parseSheetNames(content: string): string[] {
  const blockMatch = content.match(/SHEETS\s*=\s*\[[\s\S]*?\];/);
  const block = blockMatch ? blockMatch[0] : content;
  const names: string[] = [];
  const nameRe = /name:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(block)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/**
 * Primary approach: postMessage to the live Sandpack preview iframe.
 *
 * The artifact HTML (from the presentation-creator skill) has a built-in listener:
 *   window.addEventListener('message', e => {
 *     if (e.data.type === 'artifact-download-request') { intercept blob, reply }
 *   })
 * It postMessages { type: 'artifact-download', filename, data, mimeType } to e.source,
 * which is the app window. Artifacts.tsx catches that and triggers the real download.
 *
 * Returns true if the postMessage was dispatched, false if the iframe was unavailable.
 */
function triggerViaPreviewIframe(
  previewRef: MutableRefObject<SandpackPreviewRef | undefined>,
  fnName: string,
  args?: unknown[],
): boolean {
  console.log(`${LOG} [postMessage] Attempting ${fnName} via Sandpack preview iframe`);

  const client = previewRef.current?.getClient();
  if (!client) {
    console.warn(`${LOG} [postMessage] No Sandpack client — preview not yet initialised`);
    return false;
  }

  // SandpackClient base class exposes .iframe (HTMLIFrameElement)
  const iframeEl = (client as unknown as { iframe?: HTMLIFrameElement }).iframe;
  if (!iframeEl) {
    console.warn(`${LOG} [postMessage] client.iframe is absent`);
    return false;
  }

  const iframeWindow = iframeEl.contentWindow;
  if (!iframeWindow) {
    console.warn(`${LOG} [postMessage] iframe.contentWindow is null`);
    return false;
  }

  console.log(
    `${LOG} [postMessage] Dispatching { type: 'artifact-download-request', fn: '${fnName}' } to preview iframe`,
  );
  const message: Record<string, unknown> = { type: 'artifact-download-request', fn: fnName };
  // Only attach `args` when actually provided — every trigger that doesn't
  // pass export options (PPTX, and DOCX/XLSX with no options selected) keeps
  // posting the exact same zero-arg message shape as before.
  if (args && args.length > 0) {
    message.args = args;
  }
  iframeWindow.postMessage(message, '*');
  return true;
}

/**
 * How long to wait for a 'bridge-ready' signal before assuming the artifact
 * doesn't support the download-bridge.js protocol at all (e.g. an older
 * cached artifact) and falling back to the hidden-iframe path. Once
 * bridge-ready arrives, this is no longer consulted for the current
 * download — a slow export after that point is not evidence of failure,
 * just a document that takes a while to build (see bridgeReadyRef).
 */
const FALLBACK_MS = 10_000;

/**
 * Safety-net timeout for saveToDrive(): if the export throws inside the
 * hidden iframe (or otherwise never completes), no 'artifact-download'
 * message ever arrives and the message listener would wait forever,
 * leaving driveSaving stuck truthy. Generous enough to cover a real native
 * export plus the subsequent network upload.
 */
const DRIVE_SAVE_TIMEOUT_MS = 20_000;

/**
 * Safety-net timeout for captureSlides(), scaled to slide count instead of a
 * flat ceiling. Still a safety net, not a precise readiness signal — total
 * capture time is inherently variable — but it scales with the actual
 * amount of work instead of assuming every deck takes the same time
 * regardless of size. Base allowance covers html2canvas script load + the
 * fonts/settle delay; per-slide allowance covers the capture loop itself.
 */
export function computeCaptureTimeout(slideCount: number): number {
  const BASE_MS = 10_000;
  const PER_SLIDE_MS = 3_000;
  const MAX_MS = 300_000; // 5 minutes
  return Math.min(BASE_MS + slideCount * PER_SLIDE_MS, MAX_MS);
}

/**
 * Covers the CDN script fetch + fonts/settle delay in captureSlides(), before
 * slide count is known and the scaled per-slide timeout (computeCaptureTimeout)
 * can be armed. Generous enough for a slow CDN, but still a real ceiling —
 * without this, a hung (not failed) html2canvas request would wait forever,
 * since the script's onerror only fires on an outright failed request, never
 * on one that simply never resolves.
 */
export const EARLY_PHASE_TIMEOUT_MS = 15_000;

/** Splits `items` into groups of at most `size`, preserving order. */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Patch an HTML string so it works when run outside the Sandpack iframe:
 *  - Replace CDN pptxgenjs with the locally-hosted bundle
 *  - Rewrite relative /brand/ and /libs/ asset paths to absolute app-origin URLs
 *  - Inject window._BRAND_ORIGIN so the presentation script's _getOrigin() returns
 *    the correct origin even when running inside a sandboxed iframe
 */
function patchLibUrls(html: string): string {
  const origin = window.location.origin;

  // pptxgenjs — any version from any permitted CDN → local bundle
  let patched = html.replace(
    /https?:\/\/(?:cdnjs\.cloudflare\.com\/ajax\/libs\/pptxgenjs\/[^\s"'>]+|unpkg\.com\/pptxgenjs[^\s"'>]*|cdn\.jsdelivr\.net\/npm\/pptxgenjs[^\s"'>]*)/g,
    `${origin}/libs/pptxgen.bundle.js`,
  );

  // Relative /brand/ and /libs/ paths in HTML attributes (src="…") and CSS url(…)
  patched = patched
    .replace(/(src=['"])\/brand\//g, `$1${origin}/brand/`)
    .replace(/(src=['"])\/libs\//g, `$1${origin}/libs/`)
    .replace(/(url\(['"]?)\/brand\//g, `$1${origin}/brand/`)
    .replace(/(url\(['"]?)\/libs\//g, `$1${origin}/libs/`);

  // Inject _BRAND_ORIGIN before </head> so the JS fetch path uses the right origin
  const originTag = `<script>window._BRAND_ORIGIN=${JSON.stringify(origin)};</script>`;
  patched = patched.replace(/<\/head>/i, `${originTag}</head>`);

  console.log(`${LOG} [patchLibUrls] pptxgenjs CDN replaced: ${patched !== html}`);
  return patched;
}

/**
 * Fallback: load the artifact HTML in a zero-size hidden iframe, inject a blob
 * interceptor after all scripts have loaded, then call the named function.
 *
 * Used when:
 *   (a) previewRef / SandpackClient / iframe is unavailable, OR
 *   (b) the primary postMessage received no artifact-download response within FALLBACK_MS
 *       (older artifacts without the built-in message listener).
 *
 * Returns a cleanup function that removes the iframe.
 */
export function runInHiddenIframe(
  html: string,
  fnName: string,
  onError?: (message: string) => void,
  args?: unknown[],
): () => void {
  const patchedHtml = patchLibUrls(html);
  console.log(`${LOG} [hiddenIframe] Creating hidden iframe to run ${fnName}`);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
  document.body.appendChild(iframe);

  let cleanupCalled = false;
  const cleanup = () => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    console.log(`${LOG} [hiddenIframe] Removing hidden iframe`);
    try {
      document.body.removeChild(iframe);
    } catch {
      /* already removed */
    }
  };

  iframe.onload = () => {
    console.log(`${LOG} [hiddenIframe] onload fired — waiting 800 ms for post-load init`);
    setTimeout(() => {
      const win = iframe.contentWindow as any;
      if (!win) {
        console.error(`${LOG} [hiddenIframe] contentWindow is null after load`);
        cleanup();
        return;
      }

      // Diagnose which CDN libraries actually loaded
      const pptxLoaded = typeof win['PptxGenJS'] !== 'undefined';
      const xlsxLoaded = typeof win['XLSX'] !== 'undefined';
      const docxLoaded = typeof win['docx'] !== 'undefined';
      console.log(
        `${LOG} [hiddenIframe] CDN globals — PptxGenJS: ${pptxLoaded}, XLSX: ${xlsxLoaded}, docx: ${docxLoaded}`,
      );

      if (typeof win[fnName] !== 'function') {
        const message = `'${fnName}' is not a function. Ensure the artifact HTML defines this function in a <script> block.`;
        console.error(`${LOG} [hiddenIframe] ${message}`);
        onError?.(message);
        cleanup();
        return;
      }

      console.log(`${LOG} [hiddenIframe] Injecting blob interceptor then calling ${fnName}()`);
      try {
        const bridgeScript = win.document.createElement('script');
        bridgeScript.src = `${window.location.origin}/libs/download-bridge.js`;
        let bridgeInvoked = false;
        const invokeOnce = () => {
          if (bridgeInvoked) return;
          bridgeInvoked = true;
          try {
            win[fnName].apply(null, args || []);
            console.log(
              `${LOG} [hiddenIframe] ${fnName}() invoked — waiting for blob interception`,
            );
          } catch (err) {
            console.error(`${LOG} [hiddenIframe] Error invoking ${fnName}:`, err);
            onError?.(err instanceof Error ? err.message : String(err));
          }
        };
        bridgeScript.onload = invokeOnce;
        // Fallback in case the bridge script's onload never fires (e.g. blocked
        // request) — don't hang the whole flow waiting on it forever.
        setTimeout(invokeOnce, 2000);
        win.document.head.appendChild(bridgeScript);
      } catch (err) {
        console.error(`${LOG} [hiddenIframe] Error invoking ${fnName}:`, err);
      }

      // Keep iframe alive for async file generation + FileReader + postMessage round-trip
      setTimeout(cleanup, 90_000);
    }, 800);
  };

  iframe.srcdoc = patchedHtml;
  return cleanup;
}

const DownloadArtifact = ({
  artifact,
  previewRef,
}: {
  artifact: Artifact;
  previewRef?: MutableRefObject<SandpackPreviewRef | undefined>;
}) => {
  const localize = useLocalize();
  const { currentCode, setCurrentCode } = useCodeState();
  const { fileKey: fileName } = useArtifactProps({ artifact });
  const [done, setDone] = useState<string | null>(null);
  const { data: startupConfig } = useGetStartupConfig();
  const { token } = useAuthContext();
  // conversationId/model are no longer needed here: useEditArtifact keys off
  // {index, messageId} and the server resolves the conversation itself.
  const messageId = artifact.messageId;
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveSaving, setDriveSaving] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // Export-options pickers (Task 14): DOCX page size and XLSX sheet
  // selection. Only one of these is ever open at a time in practice (each
  // format has its own button), but they're independent state so opening one
  // never has to reason about the other.
  const [docxPicker, setDocxPicker] = useState<NativeFormat | null>(null);
  const [docxPageSize, setDocxPageSize] = useState<'A4' | 'Letter'>('A4');
  const [xlsxPicker, setXlsxPicker] = useState<{ fmt: NativeFormat; sheetNames: string[] } | null>(
    null,
  );
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  // Deck edits are ARTIFACT-CONTENT edits, not whole-message edits: the same
  // mechanism ArtifactCodeEditor.tsx uses. See useDeckAutosaveQueue below for
  // why useUpdateMessageMutation is the wrong tool here, and for why this
  // needs its own serialized queue rather than ArtifactCodeEditor.tsx's
  // debounced-mutation pattern (which drops edits that arrive while a
  // mutation is in flight, instead of queueing them).
  const editArtifact = useEditArtifact();
  const { enqueue: enqueueDeckSave, autosaveFailed } = useDeckAutosaveQueue({
    editArtifact,
    messageId,
    artifactIndex: artifact.index,
    initialContent: artifact.content ?? '',
    onSaved: setCurrentCode,
  });

  // Timer that arms the hidden-iframe fallback if postMessage gets no response
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cleanup fn for any in-flight hidden iframe
  const iframeCleanupRef = useRef<(() => void) | null>(null);
  // Sticky, one-way flag: set once 'bridge-ready' arrives for this component
  // instance and never reset back to false. download-bridge.js posts
  // 'bridge-ready' exactly once, at artifact mount — not per download click —
  // so this tracks "has this artifact instance ever confirmed it's alive"
  // for its whole lifetime, not "did this specific click get a fresh
  // confirmation". Once true, the fallback timer is cancelled outright rather
  // than just delayed, because we know the artifact is alive and its
  // listener is armed.
  const bridgeReadyRef = useRef(false);
  // triggerFn of the download currently in flight via the postMessage path
  // (set right before dispatching in downloadNative), so an
  // 'artifact-download-error' message can be matched to the click that
  // caused it instead of reacting to a stale/unrelated one.
  const currentDownloadFnRef = useRef<string | null>(null);
  const downloadErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ext of the Drive save currently considered "current" (set at the start of
  // every saveToDrive call). driveSaving/driveError/driveLink are component-
  // wide, not per-format, state — if a second saveToDrive(fmt2) call starts
  // before the first's (fmt1) message/timeout resolves, the first call's
  // handler and timeout are independent closures that keep running even
  // after iframeCleanupRef tears down its iframe. Without this guard, the
  // first call's abandoned timeout/handler would still fire ~20s later and
  // clobber whatever state the second (current) call had already set.
  const currentDriveExtRef = useRef<string | null>(null);

  const content = currentCode ?? artifact.content ?? '';
  const nativeFormats = detectNativeFormats(content);

  // When an artifact-download message arrives, the postMessage approach worked —
  // cancel any pending hidden-iframe fallback timer.
  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (e.data?.type === 'bridge-ready') {
        bridgeReadyRef.current = true;
        if (fallbackTimerRef.current) {
          console.log(`${LOG} bridge-ready received — artifact is alive, cancelling fallback race`);
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        return;
      }
      if (e.data?.type === 'artifact-download-error') {
        if (!currentDownloadFnRef.current || e.data.fn !== currentDownloadFnRef.current) return;
        console.error(`${LOG} artifact-download-error received:`, e.data.message);
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        currentDownloadFnRef.current = null;
        showDownloadError(String(e.data.message ?? 'Export failed'));
        return;
      }
      if (e.data?.type !== 'artifact-download') return;
      // 'artifact-download' carries a filename, not the triggerFn — match by
      // extension so a success for one concurrently-in-flight native format
      // doesn't clear the "current download" marker for a different format
      // that's still running (and may yet fail).
      if (currentDownloadFnRef.current) {
        const activeFmt = NATIVE_FORMATS.find((f) => f.triggerFn === currentDownloadFnRef.current);
        const filename = String(e.data.filename ?? '').toLowerCase();
        if (!activeFmt || filename.endsWith(`.${activeFmt.ext}`)) {
          currentDownloadFnRef.current = null;
        }
      }
      if (fallbackTimerRef.current) {
        console.log(
          `${LOG} artifact-download received — postMessage succeeded, cancelling fallback timer`,
        );
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (downloadErrorTimerRef.current) clearTimeout(downloadErrorTimerRef.current);
      iframeCleanupRef.current?.();
    };
  }, []);

  // canvas-autosave.js (Task 9) posts artifact-deck-updated whenever the
  // canvas editor's debounced autosave trigger fires — there is no longer an
  // explicit Save button. Every such message is handed to the serialized
  // autosave queue, which enforces at-most-one-mutation-in-flight and correct
  // original/updated chaining even if several edits arrive in quick
  // succession (see useDeckAutosaveQueue.ts).
  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (e.data?.type === 'artifact-deck-updated') {
        enqueueDeckSave(e.data.deck);
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [enqueueDeckSave]);

  // canvas-image-editor.js (Task 10) posts artifact-image-upload-request from
  // inside the deck iframe when its Upload tab gets a file — the iframe is
  // genuinely cross-origin (Sandpack) in production and has no access to
  // this app's auth token, so it cannot call
  // api/server/routes/files/deckAsset.js itself. This relay does that on its
  // behalf, using the same iframeWindow-resolution pattern as toggleEditing
  // above, and posts the resulting URL (or an error) back to the same iframe.
  useEffect(() => {
    const handle = async (e: MessageEvent) => {
      if (e.data?.type !== 'artifact-image-upload-request') return;
      const { requestId, dataUrl, filename } = e.data as {
        requestId: string;
        dataUrl: string;
        filename?: string;
      };
      const client = previewRef?.current?.getClient();
      const iframeWindow = (client as unknown as { iframe?: HTMLIFrameElement } | undefined)?.iframe
        ?.contentWindow;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append('file', blob, filename || 'upload.png');
        const res = await fetch(`${apiBaseUrl()}/api/files/images/deck-asset`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message || 'Upload failed');
        }
        const { url } = (await res.json()) as { url: string };
        iframeWindow?.postMessage({ type: 'artifact-image-upload-result', requestId, url }, '*');
      } catch (err) {
        console.error(`${LOG} artifact-image-upload-request failed`, err);
        iframeWindow?.postMessage(
          {
            type: 'artifact-image-upload-result',
            requestId,
            error: err instanceof Error ? err.message : 'Upload failed',
          },
          '*',
        );
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [previewRef, token]);

  // deck-renderer.js's embedFontsInPptx() and canvas-template-picker.js's
  // fetchLibrary() post artifact-asset-fetch-request from inside the deck
  // iframe when their own direct fetch(window._BRAND_ORIGIN + path) fails --
  // in production that iframe is the genuinely cross-origin Sandpack sandbox,
  // and the real app's static assets (brand fonts, master-deck-library.json)
  // don't send an Access-Control-Allow-Origin permitting that sandbox origin
  // to read the response, so the direct fetch is CORS-blocked there. This
  // relay does a normal same-origin fetch from THIS (parent) page instead --
  // which has no CORS issue since it's the app's own origin -- and posts the
  // result back to the same iframe, using the same iframeWindow-resolution
  // pattern as the image-upload relay above.
  useEffect(() => {
    const handle = async (e: MessageEvent) => {
      if (e.data?.type !== 'artifact-asset-fetch-request') return;
      const { requestId, path, encoding } = e.data as {
        requestId: string;
        path: string;
        encoding: 'base64' | 'text';
      };
      const client = previewRef?.current?.getClient();
      const iframeWindow = (client as unknown as { iframe?: HTMLIFrameElement } | undefined)?.iframe
        ?.contentWindow;
      try {
        const res = await fetch(`${window.location.origin}${path}`);
        if (!res.ok) {
          throw new Error(`Asset fetch failed: ${res.status}`);
        }
        const data =
          encoding === 'base64' ? arrayBufferToBase64(await res.arrayBuffer()) : await res.text();
        iframeWindow?.postMessage({ type: 'artifact-asset-fetch-result', requestId, data }, '*');
      } catch (err) {
        console.error(`${LOG} artifact-asset-fetch-request failed`, err);
        iframeWindow?.postMessage(
          {
            type: 'artifact-asset-fetch-result',
            requestId,
            error: err instanceof Error ? err.message : 'Asset fetch failed',
          },
          '*',
        );
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [previewRef]);

  // Reset bridgeReadyRef when a genuinely different artifact is shown.
  //
  // DownloadArtifact does NOT always remount when the artifact changes —
  // Artifacts.tsx renders it with no key tied to artifact identity, and
  // switching versions (ArtifactVersion's onVersionChange) just updates
  // which artifact id is current without remounting this component. Since
  // bridgeReadyRef is a useRef, it survives across that kind of prop change.
  // Without this reset, a ref that became `true` for one artifact version
  // would incorrectly still read `true` after switching to a different
  // (possibly older/cached, pre-download-bridge.js) version that never sends
  // its own 'bridge-ready' — causing the fallback-timer check to wrongly
  // assume the new artifact is alive and skip the fallback it actually needs.
  //
  // This only fires when artifact.id actually changes, not on every
  // render/click — that per-click reset is exactly the bug Finding 1 fixed,
  // and this effect must not reintroduce it.
  const artifactId = artifact.id;
  const isFirstArtifactIdRender = useRef(true);
  useEffect(() => {
    if (isFirstArtifactIdRender.current) {
      isFirstArtifactIdRender.current = false;
      return;
    }
    console.log(`${LOG} artifact.id changed — resetting bridgeReadyRef for new artifact`);
    bridgeReadyRef.current = false;
  }, [artifactId]);

  const flash = (key: string) => {
    setDone(key);
    setTimeout(() => setDone(null), 2500);
  };

  const showDownloadError = (message: string) => {
    if (downloadErrorTimerRef.current) clearTimeout(downloadErrorTimerRef.current);
    setDownloadError(message);
    downloadErrorTimerRef.current = setTimeout(() => setDownloadError(null), 4000);
  };

  const saveToDrive = (fmt: NativeFormat) => {
    // Mark this call as the "current" one. driveSaving/driveError/driveLink
    // are component-wide state, not per-format — every state-mutating
    // callback below (timeout, message handler, onError) checks this before
    // touching that state, so an earlier, superseded saveToDrive call's
    // late-firing timeout or late message can't clobber a newer call's
    // result once the user has moved on to a different format.
    currentDriveExtRef.current = fmt.ext;
    setDriveSaving(fmt.ext);
    setDriveLink(null);
    setDriveError(null);

    // Cancel any previous in-flight hidden iframe
    iframeCleanupRef.current?.();
    iframeCleanupRef.current = null;

    // Local to this call so concurrent/rapid saveToDrive clicks each own
    // their own timer instead of clobbering one another via a shared ref.
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handler = async (e: MessageEvent) => {
      if (e.data?.type !== 'artifact-download') return;
      if (
        !String(e.data.filename ?? '')
          .toLowerCase()
          .endsWith(`.${fmt.ext}`)
      )
        return;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('message', handler);
      try {
        const res = await fetch(`${apiBaseUrl()}/api/drive/files/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ filename: e.data.filename, ext: fmt.ext, data: e.data.data }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || 'Upload failed');
        }
        const { webViewLink } = (await res.json()) as { webViewLink: string };
        if (currentDriveExtRef.current !== fmt.ext) return;
        setDriveLink(webViewLink);
      } catch (err) {
        console.error('[DownloadArtifact] Drive upload error', err);
        if (currentDriveExtRef.current !== fmt.ext) return;
        setDriveError(err instanceof Error ? err.message : 'Drive upload failed');
      } finally {
        if (currentDriveExtRef.current === fmt.ext) setDriveSaving(null);
      }
    };
    window.addEventListener('message', handler);
    timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      if (currentDriveExtRef.current !== fmt.ext) return;
      setDriveSaving(null);
      setDriveError('Export timed out — the file may have failed to generate.');
    }, DRIVE_SAVE_TIMEOUT_MS);
    // Use hidden iframe directly so the blob interceptor captures the file
    // without triggering a local browser download as a side effect
    iframeCleanupRef.current = runInHiddenIframe(content, fmt.triggerFn, (message) => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('message', handler);
      if (currentDriveExtRef.current !== fmt.ext) return;
      setDriveSaving(null);
      setDriveError(message);
    });
  };

  /**
   * Static PDF export: inject landscape print CSS + auto-print script into the
   * artifact HTML and open it in a new tab. The browser's "Save as PDF" dialog
   * (triggered automatically after ~1s) renders the full design pixel-perfectly
   * since it uses the browser engine rather than PptxGenJS coordinate mapping.
   */
  const printPdf = () => {
    if (!content) return;

    // Injected into the print tab. @page sets the CSS viewport to exactly
    // DESIGN_W × DESIGN_H px (10in × 5.625in at 96 dpi = 960 × 540 px), which
    // matches the slide authoring dimensions — no zoom is needed or applied.
    // Applying zoom to <html> would shrink the deck below the window/page width,
    // leaving the body background exposed as a visible bar on the right side.
    const PRINT_SETUP_SCRIPT = `<script>
(function () {
  window.addEventListener('load', function () {
    var s = document.createElement('style');
    s.textContent =
      '@media print{' +
      '@page{size:10in 5.625in;margin:0}' +
      'html,body{overflow:visible!important}' +
      '.deck{position:relative!important;height:auto!important;overflow:visible!important}' +
      '.slide{position:relative!important;inset:auto!important;opacity:1!important;' +
      'transform:none!important;display:block!important;' +
      'width:100vw!important;height:100vh!important;' +
      'page-break-after:always;break-after:page}' +
      '.slide:last-child{page-break-after:avoid;break-after:avoid}' +
      '.progress-bar,.progress-fill,.slide-counter,.nav-hint,.notes{display:none!important}' +
      '*,*::before,*::after{' +
      '-webkit-print-color-adjust:exact!important;' +
      'print-color-adjust:exact!important;' +
      'color-adjust:exact!important}}';
    document.head.appendChild(s);
    // ponytail: fonts.ready > setTimeout — avoids FOUT in PDF
    document.fonts.ready.then(function () { window.print(); });
  });
}());
</script>`;

    const printHtml = patchLibUrls(content).replace(/<\/head>/i, PRINT_SETUP_SCRIPT + '</head>');
    const blob = new Blob([printHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    // Use an anchor click instead of window.open — browsers do not block anchor-based
    // navigation triggered from a user gesture, whereas window.open is often suppressed
    // by popup blockers even inside a direct click handler.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Keep the blob URL alive long enough for the new tab to finish loading
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    flash('pdf');
  };

  // Option 3 + 6: flatten unsupported CSS effects so the PDF works in all viewers.
  // Strips backdrop-filter, mix-blend-mode, SVG filters, masks, and complex transforms
  // that Chromium renders fine on-screen but that break when re-rendered by PDF viewers.
  const printPdfCompat = () => {
    if (!content) return;

    const COMPAT_SETUP_SCRIPT = `<script>
(function () {
  window.addEventListener('load', function () {
    var s = document.createElement('style');
    // Flatten effects unsupported by most PDF viewers
    s.textContent =
      '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' +
      '*{mix-blend-mode:normal!important}' +
      '*{filter:none!important}' +
      '*{-webkit-mask:none!important;mask:none!important}' +
      '*{text-shadow:none!important}' +
      '@media print{' +
      '@page{size:10in 5.625in;margin:0}' +
      'html,body{overflow:visible!important}' +
      '.deck{position:relative!important;height:auto!important;overflow:visible!important}' +
      '.slide{position:relative!important;inset:auto!important;opacity:1!important;' +
      'transform:none!important;display:block!important;' +
      'width:100vw!important;height:100vh!important;' +
      'page-break-after:always;break-after:page}' +
      '.slide:last-child{page-break-after:avoid;break-after:avoid}' +
      '.progress-bar,.progress-fill,.slide-counter,.nav-hint,.notes{display:none!important}' +
      '*,*::before,*::after{' +
      '-webkit-print-color-adjust:exact!important;' +
      'print-color-adjust:exact!important;' +
      'color-adjust:exact!important}}';
    document.head.appendChild(s);
    document.fonts.ready.then(function () { window.print(); });
  });
}());
</script>`;

    const printHtml = patchLibUrls(content).replace(/<\/head>/i, COMPAT_SETUP_SCRIPT + '</head>');
    const blob = new Blob([printHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    flash('pdf-compat');
  };

  // Dynamically load PptxGenJS into the main window (it's bundled at /libs/).
  // Reuses window.PptxGenJS if already loaded.
  const loadPptxGen = (): Promise<typeof window.PptxGenJS> =>
    window.PptxGenJS
      ? Promise.resolve(window.PptxGenJS)
      : new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = '/libs/pptxgen.bundle.js';
          s.onload = () => resolve(window.PptxGenJS);
          s.onerror = reject;
          document.head.appendChild(s);
        });

  /**
   * Client-side slide capture: loads the artifact in a hidden same-origin iframe
   * (srcdoc = blob URL → same origin), injects html2canvas, makes every .slide
   * visible, screenshots each at 2× device scale, returns data URLs.
   *
   * No server required. Works in any deployment environment.
   */
  const captureSlides = (
    html: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<string[]> =>
    new Promise((resolve, reject) => {
      const patchedHtml = patchLibUrls(html);

      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      // Off-screen but real-sized so 100vw/100vh slides render at correct dimensions
      iframe.style.cssText =
        'position:fixed;width:1280px;height:720px;border:0;top:-9999px;left:-9999px;pointer-events:none;';
      document.body.appendChild(iframe);

      const cleanup = () => {
        try {
          document.body.removeChild(iframe);
        } catch {
          /* already removed */
        }
      };

      let capturedCount = 0;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      // Guards against continuing async work after the promise has already
      // settled (e.g. EARLY_PHASE_TIMEOUT_MS fired and rejected while the
      // CDN script load was still in flight). Without this, a late-arriving
      // html2canvas load would go on to query the already-removed iframe's
      // document, re-arm a new timeout, and run the full capture loop against
      // a promise nothing is listening to anymore.
      let settled = false;

      const armTimeout = (ms: number, onFire: () => void) => {
        timeoutId = setTimeout(() => {
          cleanup();
          settled = true;
          onFire();
        }, ms);
      };

      const clearArmedTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = null;
      };

      iframe.onload = () => {
        // Give fonts, brand images, and scripts time to settle
        setTimeout(async () => {
          armTimeout(EARLY_PHASE_TIMEOUT_MS, () => {
            reject(new Error('Slide capture timed out waiting for html2canvas to load'));
          });

          try {
            const win = iframe.contentWindow as any;
            const doc = iframe.contentDocument as Document;

            // Inject html2canvas from our own locally-vendored bundle (matches
            // pptxgenjs/xlsx/docx/jszip, all copied into client/public/libs/ by
            // scripts/copy-libs.mjs) rather than a third-party CDN. A CDN
            // dependency here meant PDF (HD) / PPTX (HD) could fail for reasons
            // entirely outside this app's control -- a corporate network
            // policy, an ad-blocker/security browser extension, or the CDN
            // itself being unreachable -- while every other download path
            // (which has no CDN dependency) kept working, making the failure
            // look format-specific when it was actually an availability issue.
            await new Promise<void>((res, rej) => {
              const s = doc.createElement('script');
              s.src = `${window.location.origin}/libs/html2canvas.min.js`;
              s.onload = () => res();
              s.onerror = () => rej(new Error('html2canvas failed to load'));
              doc.head.appendChild(s);
            });
            // The early-phase timeout may have already fired (and rejected)
            // while the CDN script load above was still in flight. Bail out
            // rather than continuing to work against an already-removed
            // iframe and an already-settled promise.
            if (settled) return;

            const slideEls = [...doc.querySelectorAll<HTMLElement>('.slide')];
            if (slideEls.length === 0) throw new Error('No .slide elements found in artifact');

            clearArmedTimeout();
            armTimeout(computeCaptureTimeout(slideEls.length), () => {
              reject(
                new Error(
                  `Slide capture timed out after capturing ${capturedCount} of ${slideEls.length} slides`,
                ),
              );
            });

            // Reveal all slides flat so html2canvas can see them
            const FORCE_VISIBLE = `
              .slide {
                position: relative !important;
                inset: auto !important;
                opacity: 1 !important;
                transform: none !important;
                display: block !important;
                width: 1280px !important;
                height: 720px !important;
                pointer-events: none !important;
              }
              .deck { position: relative !important; height: auto !important; overflow: visible !important; }
              .progress-bar, .slide-counter, .nav-hint, .notes { display: none !important; }
            `;
            const styleEl = doc.createElement('style');
            styleEl.textContent = FORCE_VISIBLE;
            doc.head.appendChild(styleEl);

            if (settled) return;
            const pngs: string[] = [];
            const batches = chunk(slideEls, 4);
            for (const batch of batches) {
              // The scaled per-slide timeout armed above is most likely to
              // actually fire here, mid-loop, on a real large deck (e.g.
              // after batch 5 of 10). Once that happens the iframe is torn
              // down and the promise has already rejected — bail out instead
              // of continuing to await further html2canvas batches against a
              // removed iframe and eventually calling a no-op resolve().
              if (settled) return;
              const batchPngs = await Promise.all(
                batch.map((el) =>
                  (win.html2canvas as any)(el, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#25223B',
                    width: 1280,
                    height: 720,
                    logging: false,
                  }).then((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png')),
                ),
              );
              pngs.push(...batchPngs);
              capturedCount = pngs.length;
              onProgress?.(capturedCount, slideEls.length);
            }

            clearArmedTimeout();
            cleanup();
            settled = true;
            resolve(pngs);
          } catch (err) {
            clearArmedTimeout();
            cleanup();
            settled = true;
            reject(err);
          }
        }, 1200);
      };

      iframe.srcdoc = patchedHtml;
    });

  /**
   * HD PDF: captures every slide as a PNG in the browser, builds a printable HTML
   * (one <img> per page), opens it in a new tab, and auto-triggers the print dialog.
   * The user saves as PDF — same UX as the normal PDF button but pixel-perfect images.
   * Zero server calls, zero new production dependencies.
   */
  const downloadPdfHD = async () => {
    if (!content) return;
    flash('pdf-hd');
    try {
      const pngs = await captureSlides(content, (doneCount, total) => {
        console.log(`${LOG} PDF (HD) capture progress: ${doneCount}/${total}`);
      });
      const imgTags = pngs.map((src) => `<img src="${src}" alt="">`).join('');
      const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:10in 5.625in;margin:0}
  body{background:#25223B}
  img{display:block;width:100vw;height:100vh;object-fit:cover;page-break-after:always;break-after:page}
  img:last-child{page-break-after:avoid;break-after:avoid}
</style>
<script>
  window.addEventListener('load', function () {
    document.fonts.ready.then(function () { window.print(); });
  });
</script>
</head><body>${imgTags}</body></html>`;
      const blob = new Blob([printHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      flash('pdf-hd');
    } catch (err) {
      console.error(`${LOG} HD PDF failed`, err);
      flash('pdf-hd-err');
    }
  };

  /**
   * HD PPTX: captures every slide as a PNG then assembles a PPTX with each slide
   * as a full-bleed image using PptxGenJS (already bundled at /libs/).
   * Pixel-perfect visual fidelity — no server, no Playwright.
   */
  const downloadPptxHD = async () => {
    if (!content) return;
    flash('pptx-hd');
    try {
      const pngs = await captureSlides(content, (doneCount, total) => {
        console.log(`${LOG} PPTX (HD) capture progress: ${doneCount}/${total}`);
      });
      const PptxGenJS = await loadPptxGen();
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      for (const png of pngs) {
        const slide = pptx.addSlide();
        // png is a full data URL — PptxGenJS accepts it directly
        slide.addImage({ data: png, x: 0, y: 0, w: '100%', h: '100%' });
      }
      const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.[^.]+$/, '') + '-hd.pptx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      flash('pptx-hd');
    } catch (err) {
      console.error(`${LOG} HD PPTX failed`, err);
      flash('pptx-hd-err');
    }
  };

  const downloadHtml = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    flash('html');
  };

  // Toggles the deck-editor.js contenteditable state inside the live Sandpack
  // preview iframe by posting artifact-editor-toggle, which download-bridge.js
  // relays to window.DeckEditor.{enableEditing,disableEditing}.
  const toggleEditing = () => {
    const next = !isEditing;
    setIsEditing(next);
    const client = previewRef?.current?.getClient();
    const iframeWindow = (client as unknown as { iframe?: HTMLIFrameElement } | undefined)?.iframe
      ?.contentWindow;
    iframeWindow?.postMessage({ type: 'artifact-editor-toggle', enabled: next }, '*');
  };

  const downloadNative = (fmt: NativeFormat, args?: unknown[]) => {
    console.log(`${LOG} Download requested: ${fmt.label} (triggerFn: ${fmt.triggerFn})`);
    console.log(`${LOG} content length: ${content.length}, has previewRef: ${!!previewRef}`);

    // Cancel any previous in-flight attempt before starting a new one.
    // NOTE: bridgeReadyRef is intentionally NOT reset here. download-bridge.js
    // posts 'bridge-ready' exactly once, when the artifact's script first
    // loads (i.e. when the Sandpack preview iframe mounts) — well before any
    // download click. The same iframe/artifact instance stays alive across
    // multiple clicks, so once bridge-ready has arrived for this component
    // instance it remains valid evidence of liveness for every subsequent
    // click too. Resetting it per-click would mean no second 'bridge-ready'
    // ever arrives, and the fallback race would incorrectly trigger on every
    // click after the first.
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    iframeCleanupRef.current?.();
    iframeCleanupRef.current = null;

    if (previewRef) {
      const sent = triggerViaPreviewIframe(
        previewRef as MutableRefObject<SandpackPreviewRef | undefined>,
        fmt.triggerFn,
        args,
      );
      if (sent) {
        console.log(
          `${LOG} postMessage dispatched — hidden-iframe fallback armed for ${FALLBACK_MS} ms`,
        );
        currentDownloadFnRef.current = fmt.triggerFn;
        fallbackTimerRef.current = setTimeout(() => {
          if (bridgeReadyRef.current) {
            // Artifact is alive and just slow (large document) — do not race
            // a second export. Let the original run to completion.
            fallbackTimerRef.current = null;
            return;
          }
          console.warn(
            `${LOG} No bridge-ready after ${FALLBACK_MS} ms. ` +
              `The artifact may not have the download-bridge.js listener (older artifact). ` +
              `Running hidden-iframe fallback.`,
          );
          fallbackTimerRef.current = null;
          iframeCleanupRef.current = runInHiddenIframe(
            content,
            fmt.triggerFn,
            showDownloadError,
            args,
          );
        }, FALLBACK_MS);
        flash(fmt.ext);
        return;
      }
      console.warn(`${LOG} postMessage unavailable — falling back to hidden iframe immediately`);
    } else {
      console.log(`${LOG} No previewRef provided — using hidden iframe`);
    }

    iframeCleanupRef.current = runInHiddenIframe(content, fmt.triggerFn, showDownloadError, args);
    flash(fmt.ext);
  };

  /**
   * Entry point for the per-format download button. DOCX always opens a
   * page-size popover first (no way to parse a meaningful default from
   * source text, so the choice is always offered). XLSX opens a
   * sheet-selection popover only when more than one sheet name could be
   * parsed from the artifact's source — for zero or one sheet there's
   * nothing useful to choose, so it proceeds straight to downloadNative
   * (fail open, per the design's never-block-a-download requirement).
   * Every other format is unaffected and downloads immediately, as before.
   */
  const handleDownloadClick = (fmt: NativeFormat) => {
    if (fmt.triggerFn === 'downloadDocx') {
      setDocxPageSize('A4');
      setDocxPicker(fmt);
      return;
    }
    if (fmt.triggerFn === 'downloadExcel') {
      const sheetNames = parseSheetNames(content);
      if (sheetNames.length > 1) {
        setSelectedSheets(new Set(sheetNames));
        setXlsxPicker({ fmt, sheetNames });
        return;
      }
      downloadNative(fmt);
      return;
    }
    downloadNative(fmt);
  };

  const confirmDocxDownload = () => {
    if (!docxPicker) return;
    downloadNative(docxPicker, [{ pageSize: docxPageSize }]);
    setDocxPicker(null);
  };

  const toggleSelectedSheet = (name: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const confirmXlsxDownload = () => {
    if (!xlsxPicker) return;
    downloadNative(xlsxPicker.fmt, [Array.from(selectedSheets)]);
    setXlsxPicker(null);
  };

  // Show PDF button only for presentations (which have downloadPptx)
  const isPresentationArtifact = nativeFormats.some((f) => f.triggerFn === 'downloadPptx');
  // Editor toggle is presentation-only per the design spec's Non-Goals —
  // decks are the only artifact type deck-editor.js supports.
  const isDeckArtifact = nativeFormats.some((f) => f.ext === 'pptx');

  // Shared page-size / sheet-selection popovers for the DOCX/XLSX export
  // options pickers. Rendered once (not per-format) since docxPicker/
  // xlsxPicker are singular, component-wide state — only one can be open at
  // a time regardless of which button/menu-item container triggered it.
  const exportOptionPickers = (
    <>
      {docxPicker && (
        <div
          role="dialog"
          aria-label="DOCX page size"
          className="absolute top-8 z-10 rounded-md border border-border-light bg-surface-primary p-3 text-xs shadow-lg"
        >
          <div className="mb-2 font-medium">{localize('com_ui_page_size')}</div>
          {/* A4/Letter are format-name proper nouns, not UI verbs — left as
            literal strings, matching how PPTX/XLSX/DOCX (fmt.label) are
            already handled as literal, unlocalized labels in this file. */}
          <label className="mb-1 flex items-center gap-2">
            <input
              type="radio"
              name="docx-page-size"
              aria-label="A4"
              checked={docxPageSize === 'A4'}
              onChange={() => setDocxPageSize('A4')}
            />
            A4
          </label>
          <label className="mb-2 flex items-center gap-2">
            <input
              type="radio"
              name="docx-page-size"
              aria-label="Letter"
              checked={docxPageSize === 'Letter'}
              onChange={() => setDocxPageSize('Letter')}
            />
            Letter
          </label>
          <div className="flex gap-2">
            <Button size="sm" className="h-6 px-2 text-xs" onClick={confirmDocxDownload}>
              {localize('com_ui_download')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setDocxPicker(null)}
            >
              {localize('com_ui_cancel')}
            </Button>
          </div>
        </div>
      )}
      {xlsxPicker && (
        <div
          role="dialog"
          aria-label="XLSX sheet selection"
          className="absolute top-8 z-10 rounded-md border border-border-light bg-surface-primary p-3 text-xs shadow-lg"
        >
          <div className="mb-2 font-medium">{localize('com_ui_sheets_to_export')}</div>
          {xlsxPicker.sheetNames.map((name) => (
            <label key={name} className="mb-1 flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={name}
                checked={selectedSheets.has(name)}
                onChange={() => toggleSelectedSheet(name)}
              />
              {name}
            </label>
          ))}
          <div className="mt-1 flex gap-2">
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={confirmXlsxDownload}
              disabled={selectedSheets.size === 0}
            >
              {localize('com_ui_download')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setXlsxPicker(null)}
            >
              {localize('com_ui_cancel')}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  // Live status feedback (Drive spinner/error/success, download error) must
  // stay visible OUTSIDE the dropdown at all times — folding it into a
  // closed menu would hide exactly the information a user needs when a
  // download or Drive save is in flight or has just failed/succeeded.
  const driveAndErrorFeedback = (
    <>
      {nativeFormats.map((fmt) => (
        <React.Fragment key={`drive-${fmt.ext}`}>
          {startupConfig?.googleDrivePickerEnabled && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-medium"
              onClick={() => saveToDrive(fmt)}
              disabled={driveSaving === fmt.ext}
              aria-label={`Save ${fmt.label} to Google Drive`}
            >
              {driveSaving === fmt.ext && <Loader2 size={12} className="mr-1 animate-spin" />}
              {driveSaving === fmt.ext ? 'Saving...' : 'Drive'}
            </Button>
          )}
        </React.Fragment>
      ))}
      {driveError && driveSaving === null && (
        <span className="flex h-7 items-center px-2 text-xs text-red-500" title={driveError}>
          Drive failed
        </span>
      )}
      {driveLink && driveSaving === null && (
        <a
          href={driveLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-7 items-center px-2 text-xs font-medium text-primary hover:underline"
        >
          Open ↗
        </a>
      )}
      {downloadError && (
        <span className="flex h-7 items-center px-2 text-xs text-red-500" title={downloadError}>
          Download failed
        </span>
      )}
    </>
  );

  // Edit/Done Editing is a distinct primary action (not a download variant)
  // and is kept as its own always-visible button OUTSIDE the dropdown so
  // it's not buried behind an extra click.
  const editButton = isDeckArtifact && (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs font-medium"
        onClick={toggleEditing}
        aria-label={isEditing ? localize('com_ui_done_editing') : localize('com_ui_edit')}
      >
        {isEditing ? localize('com_ui_done_editing') : localize('com_ui_edit')}
      </Button>
      {/* Non-blocking autosave-failed indicator (Task 9): edits are
          autosaved via a debounced, serialized queue rather than an
          explicit Save button. Local edits are never lost when this
          shows — only server persistence lags — so nothing here disables
          further editing. */}
      {autosaveFailed && (
        <span
          className="flex h-7 items-center px-2 text-xs text-red-500"
          title={localize('com_ui_autosave_failed')}
        >
          {localize('com_ui_autosave_failed')}
        </span>
      )}
    </>
  );

  if (!isPresentationArtifact) {
    // Non-presentation (DOCX/XLSX-only) artifacts are out of scope for the
    // download-menu consolidation — unchanged flat button row.
    return (
      <div className="relative flex flex-wrap items-center justify-end gap-1">
        {nativeFormats.map((fmt) => (
          <React.Fragment key={fmt.ext}>
            {/* Wrapped in its own `relative` container (not the whole, now-wrappable
                toolbar) so each popover anchors under ITS OWN button — with
                flex-wrap on the outer row, a later button can land on a second
                line, and `absolute top-8` relative to the whole toolbar would then
                detach the popover from the button that opened it. */}
            <div className="relative inline-flex">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs font-medium"
                onClick={() => handleDownloadClick(fmt)}
                aria-label={`Download as ${fmt.label}`}
              >
                {done === fmt.ext && (
                  <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />
                )}
                {fmt.label}
              </Button>
              {docxPicker?.ext === fmt.ext && exportOptionPickers}
              {xlsxPicker?.fmt.ext === fmt.ext && exportOptionPickers}
            </div>
            {startupConfig?.googleDrivePickerEnabled && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs font-medium"
                onClick={() => saveToDrive(fmt)}
                disabled={driveSaving === fmt.ext}
                aria-label={`Save ${fmt.label} to Google Drive`}
              >
                {driveSaving === fmt.ext && <Loader2 size={12} className="mr-1 animate-spin" />}
                {driveSaving === fmt.ext ? 'Saving...' : 'Drive'}
              </Button>
            )}
            {driveError && driveSaving === null && (
              <span className="flex h-7 items-center px-2 text-xs text-red-500" title={driveError}>
                Drive failed
              </span>
            )}
            {driveLink && driveSaving === null && (
              <a
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-7 items-center px-2 text-xs font-medium text-primary hover:underline"
              >
                Open ↗
              </a>
            )}
            {downloadError && (
              <span
                className="flex h-7 items-center px-2 text-xs text-red-500"
                title={downloadError}
              >
                Download failed
              </span>
            )}
          </React.Fragment>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs font-medium"
          onClick={downloadHtml}
          aria-label={localize('com_ui_download_artifact')}
        >
          {done === 'html' && <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />}
          HTML
        </Button>
        {editButton}
      </div>
    );
  }

  // Presentation artifacts: every download FORMAT option (native format,
  // PDF/PDF Compat/PDF HD/PPTX HD, HTML) consolidates into a single
  // "Download" trigger + dropdown menu, per the UI-polish fix — the same
  // handlers/checkmark/disabled logic as before, just rendered as menu items
  // instead of a flat row of 6-7 separate buttons.
  return (
    <div className="relative flex flex-wrap items-center justify-end gap-1">
      <div className="relative inline-flex">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-medium"
              aria-label={localize('com_ui_download')}
            >
              <Download size={13} className="mr-1" aria-hidden="true" />
              {localize('com_ui_download')}
              <ChevronDown size={13} className="ml-1" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {nativeFormats.map((fmt) => (
              <DropdownMenuItem
                key={fmt.ext}
                onClick={() => handleDownloadClick(fmt)}
                aria-label={`Download as ${fmt.label}`}
              >
                {done === fmt.ext && (
                  <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />
                )}
                {fmt.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={printPdf}
              aria-label="Export as PDF (opens print dialog)"
              title="Opens in a new tab — use browser Save as PDF for pixel-perfect output"
            >
              {done === 'pdf' && <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />}
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={printPdfCompat}
              aria-label="Export as PDF (compatibility mode — flattens glass effects)"
              title="Strips backdrop-filter, blend modes, and SVG filters before printing — more compatible with PDF viewers"
            >
              {done === 'pdf-compat' && (
                <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />
              )}
              PDF (Compat)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={downloadPdfHD}
              aria-label="Export as PDF (client-rendered, pixel-perfect)"
              title="Screenshots each slide at 2× resolution in-browser and assembles a printable PDF — preserves visual fidelity but does not support backdrop-filter or blend modes"
            >
              {done === 'pdf-hd' && (
                <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />
              )}
              PDF (HD)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={downloadPptxHD}
              aria-label="Export as PPTX (image-based, pixel-perfect)"
              title="Screenshots each slide at 2× resolution and assembles as a full-bleed image PPTX"
            >
              {done === 'pptx-hd' && (
                <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />
              )}
              PPTX (HD)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={downloadHtml}
              aria-label={localize('com_ui_download_artifact')}
            >
              {done === 'html' && <CircleCheckBig size={13} className="mr-1" aria-hidden="true" />}
              HTML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Selecting DOCX/XLSX in the menu closes the menu (Radix's default
            item-select behaviour) and opens this picker instead — same
            confirm/cancel handlers as before, now anchored under the single
            Download button rather than under a per-format button. */}
        {exportOptionPickers}
      </div>
      {driveAndErrorFeedback}
      {editButton}
    </div>
  );
};

export default DownloadArtifact;
