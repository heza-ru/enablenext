import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type * as t from 'librechat-data-provider';

const LOG = '[useDeckAutosaveQueue]';

/**
 * Serialized autosave queue for the Konva canvas editor's deck edits.
 *
 * Root constraint (see design spec's "Autosave" section): `replaceArtifactContent`
 * persists by locating the exact `original` string as a literal substring
 * inside the message's current stored text and splicing in `updated` — it is
 * NOT a wholesale-document PUT. If two saves were ever in flight concurrently,
 * a later save carrying a stale `original` would either fail its lookup (edit
 * silently dropped) or a late-resolving stale response could clobber a newer
 * save's result. This hook enforces the invariants that make that impossible:
 *
 * 1. At most one `useEditArtifact` mutation is in flight at a time.
 * 2. A deck update that arrives while a save is in flight coalesces into the
 *    NEXT queued save rather than firing a second mutation concurrently.
 * 3. Each save's `original` is always the exact `updated` string the PREVIOUS
 *    save in this queue actually sent — tracked via `lastKnownContent`, a ref
 *    set on DISPATCH (not on success, and never read back from the mutation
 *    response or the `artifact` prop), so a second coalesced save queued
 *    while the first is in flight already has the correct `original`.
 * 4. On failure, retry once (re-dispatching the identical {original, updated}
 *    pair — `lastKnownContent` was already advanced to `updated` before the
 *    first attempt, so no extra bookkeeping is needed for the retry itself).
 *    If the retry also fails, surface `autosaveFailed` — local edits are
 *    never lost (window.DECK / the canvas already reflects them), only
 *    server persistence lags.
 */
export function useDeckAutosaveQueue({
  editArtifact,
  messageId,
  artifactIndex,
  initialContent,
  onSaved,
}: {
  editArtifact: UseMutationResult<t.TEditArtifactResponse, Error, t.TEditArtifactRequest, unknown>;
  messageId: string | undefined;
  artifactIndex: number | undefined;
  /** `artifact.content` — the starting point for the very first save this session. */
  initialContent: string;
  /** Called with the `updated` body immediately after a save is dispatched. */
  onSaved?: (updated: string) => void;
}) {
  const [autosaveFailed, setAutosaveFailed] = useState(false);

  // Tracks exactly what THIS component last dispatched as `updated` — never a
  // value read back from a mutation response or the `artifact` prop, which is
  // the flaw ArtifactCodeEditor.tsx's debounced-mutation pattern has (it uses
  // artifact.content, which only updates after the query cache round-trips).
  const lastKnownContent = useRef(initialContent);
  // Reset the whole queue's baseline whenever a genuinely new artifact
  // session starts (e.g. switching artifact versions), mirroring the
  // bridgeReadyRef reset pattern already used elsewhere in this file family.
  const isFirstContentRender = useRef(true);
  useEffect(() => {
    if (isFirstContentRender.current) {
      isFirstContentRender.current = false;
      return;
    }
    lastKnownContent.current = initialContent;
  }, [initialContent]);

  const inFlightRef = useRef(false);
  const pendingDeckRef = useRef<object | null>(null);
  const lastSentDeckJsonRef = useRef<string | null>(null);

  const editArtifactRef = useRef(editArtifact);
  useEffect(() => {
    editArtifactRef.current = editArtifact;
  }, [editArtifact]);

  const messageIdRef = useRef(messageId);
  useEffect(() => {
    messageIdRef.current = messageId;
  }, [messageId]);

  const artifactIndexRef = useRef(artifactIndex);
  useEffect(() => {
    artifactIndexRef.current = artifactIndex;
  }, [artifactIndex]);

  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  function dispatchSave(original: string, updated: string, isRetry: boolean) {
    const msgId = messageIdRef.current;
    const index = artifactIndexRef.current;
    if (!msgId || index == null) {
      inFlightRef.current = false;
      return;
    }

    inFlightRef.current = true;
    editArtifactRef.current.mutate(
      { index, messageId: msgId, original, updated },
      {
        onSuccess: () => {
          onSavedRef.current?.(updated);
          setAutosaveFailed(false);
          inFlightRef.current = false;
          processNextIfAny();
        },
        onError: (err) => {
          if (!isRetry) {
            console.warn(`${LOG} save failed, retrying once`, err);
            // Re-dispatch the IDENTICAL {original, updated} pair — no
            // recomputation needed. lastKnownContent.current was already
            // advanced to `updated` at the moment this save was first
            // dispatched (see enqueue below), so any THIRD deck change that
            // arrives while this retry is in flight already has the correct
            // `original` to chain from regardless of how this retry resolves.
            dispatchSave(original, updated, true);
            return;
          }
          console.error(`${LOG} retry also failed — surfacing autosave-failed indicator`, err);
          setAutosaveFailed(true);
          inFlightRef.current = false;
          processNextIfAny();
        },
      },
    );
  }

  function processNextIfAny() {
    if (pendingDeckRef.current == null) return;
    const next = pendingDeckRef.current;
    pendingDeckRef.current = null;
    enqueue(next);
  }

  // Stable identity (empty deps — the body only ever reads/writes refs) so
  // consumers can safely list it in a useEffect dependency array without the
  // listener being torn down and re-added on every render.
  const enqueue = useCallback((deck: object) => {
    const deckJson = JSON.stringify(deck);
    // Skip entirely if identical to what's already been sent (or is currently
    // in flight, since lastSentDeckJsonRef is set at dispatch time) — avoids
    // redundant saves for e.g. a selection-only notifyChange with no actual
    // geometry/content change.
    if (deckJson === lastSentDeckJsonRef.current) return;

    if (inFlightRef.current) {
      pendingDeckRef.current = deck;
      return;
    }

    // `original` is always the exact `updated` string the PREVIOUS save in
    // this queue actually sent (or `initialContent` for the very first save),
    // never a snapshot read from `artifact.content` or a mutation response —
    // that's what makes the substring match on the server always succeed
    // regardless of debounce/coalescing timing.
    const original = lastKnownContent.current;
    const updated = original.replace(
      /window\.DECK\s*=\s*\{[\s\S]*?\};/,
      'window.DECK = ' + deckJson + ';',
    );

    // Advance the tracked "last dispatched" content on DISPATCH, not on
    // mutation success — a second coalesced save queued while this one is in
    // flight must use THIS save's `updated` as its `original`, per the design
    // spec's invariant, regardless of whether this save has resolved yet.
    lastKnownContent.current = updated;
    lastSentDeckJsonRef.current = deckJson;

    dispatchSave(original, updated, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { enqueue, autosaveFailed };
}
