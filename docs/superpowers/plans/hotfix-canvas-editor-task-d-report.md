# Hotfix: stop over-anchoring on slide-5/slide-97 (Task D)

## Root cause

A user reported that generated decks always used the exact same title slide
(`componentId: "slide-5"`) and the exact same closing slide
(`componentId: "slide-97"`), regardless of the deck's actual purpose —
including a closing slide with a CTA-shaped element inherited unmodified,
even for internal/POC decks that shouldn't have a sales CTA.

Traced to `agents/presentation-creator.skill.md`:

1. The "Workflow" paragraph in the "Schema Layout & the Master Deck Library"
   section instructed the model to *start with* the one embedded example per
   category ("Practical examples" only embeds one variant each: `slide-5`
   for title, `slide-97` for closing) and only look at other variants in the
   range if that one "doesn't fit" structurally — a low bar that the model
   almost always cleared, so it never explored the rest of the range
   (`slide-5`..`9`, `slide-97`..`100`).
2. The `slide-97` example's caption told the model to "swap `Thank you!` for
   a real closing line (or a CTA)" with no condition on the deck's purpose,
   so any deck could end up with a sales CTA baked into the closing slide.

## Verification of slide-97's actual content

Cross-checked the embedded excerpt in the skill file against
`client/public/brand/master-deck-library.json` directly (`componentId:
"slide-97"`). The two match exactly. `slide-97` has exactly one text
element — `"Thank you!"` at `x:0, y:2.26, w:5.64, h:0.74` — and 10 shape
(rect) elements with no text, forming a decorative warm-toned collage. The
"CTA-shaped element" described in the task (~2.29 × 0.83in rect near the
bottom) is the shape at `fill: "824E3B", x:5.4, y:4.45, w:2.29, h:0.83` —
it is a plain decorative rect with no text/label, not literal baked-in CTA
copy. The actual risk is not that `slide-97` ships CTA text by default —
it's that the skill file's own prose invited the model to *turn* the plain
"Thank you!" text into arbitrary CTA copy without checking whether the
deck's purpose called for one, and to always reach for `slide-97` in the
first place rather than considering `slide-98`..`100` or genuinely deciding
what the closing slide should say.

## Edit 1 — Workflow paragraph (~line 173)

**Before:**
> **Workflow**: for any title/section/agenda/closing slide, start with the
> matching embedded example in "Practical examples" below and inline its
> `elements` array (editing only the `.text` fields you need to change, per
> the rules below). If that specific example's copy shape doesn't fit and
> you need a different variant from the same range, `file_search` the rest
> of the `componentId` range in `master-deck-library.json` (and
> `brand/master-deck-layouts.md`'s category table) to find one that does.
> Only fall back to the plain `title`/`section`/`agenda`/`closing` layout
> when you've checked the range and genuinely nothing fits (e.g. every
> variant in range has fixed copy that can't be adapted to the content, or
> — per the known limitations below — the only remaining unused variant is
> one of the mis-scaled/oversized-shape slides that can't be cleanly
> copied). Don't skip the check just because the hand-coded layout is less
> typing; the fallback existing at all is not license to default to it.

**After:**
> **Workflow**: for any title/section/agenda/closing slide, first decide
> what that category actually needs to say based on the deck's real
> content and purpose — don't start from a specific slide. Use the
> matching embedded example in "Practical examples" below only as a
> **reference for `elements` field shape and conventions** (how a title
> cover is composed, how an agenda's session rows repeat, what a closing
> slide's decorative collage looks like) — not as the slide you reuse by
> default. Then pick whichever `componentId` in the documented range
> (`slide-5`..`9` for title, `slide-97`..`100` for closing, etc. — not only
> the one embedded above) genuinely matches what this deck needs;
> `file_search` the rest of the range in `master-deck-library.json` (and
> `brand/master-deck-layouts.md`'s category table) whenever the embedded
> example isn't clearly the best fit for this specific deck — not only
> when it's structurally broken. **Reusing the same `componentId` (e.g.
> always `slide-5` for every cover, always `slide-97` for every close)
> across different decks and requests is exactly the failure mode this
> rule exists to prevent** — vary the choice based on the deck's actual
> audience, tone, and purpose, the same way you'd vary layout choices
> elsewhere in this skill. Only fall back to the plain
> `title`/`section`/`agenda`/`closing` layout when you've checked the range
> and genuinely nothing fits (e.g. every variant in range has fixed copy
> that can't be adapted to the content, or — per the known limitations
> below — the only remaining unused variant is one of the
> mis-scaled/oversized-shape slides that can't be cleanly copied). Don't
> skip the check just because the hand-coded layout is less typing; the
> fallback existing at all is not license to default to it.

Why: removes the "one embedded example is the default, only look further
if it structurally doesn't fit" framing and replaces it with an explicit
instruction to decide content needs first, treat the embedded example as a
field-shape reference only, and explicitly names "always reusing the same
componentId" as the failure mode being fixed.

## Edit 2 — new Content Rule 6 (~line 154)

Added to the "Content Rules (apply before writing any slide spec)" section,
after the existing 5 rules, matching their numbered/bolded-directive style:

> 6. **Closing content matches the deck's purpose** — a sales/pitch-facing
> deck may reasonably close with a demo/POC call-to-action, but an
> internal, executive-readout, technical, or informational deck should
> close with a plain thank-you/summary and must **not** include a sales
> CTA just because a `componentId` example happened to have one baked in.
> If you're using a `componentId`-sourced closing slide (`slide-97`..`100`)
> and the deck doesn't call for a CTA, don't invent one just because the
> source example's text field is easy to overwrite with pitch copy — write
> a purpose-appropriate line (e.g. "Thank you!" or "Questions?") instead.
> If the deck genuinely does call for a CTA, either edit the closing text
> to something specific to this deck (never boilerplate carried over
> unedited) or pick a different variant in the range that fits better —
> don't ship a mismatched CTA just because it was the path of least typing.

Why: this section is the file's designated place for content-shape rules
applied "before writing any slide spec," which is exactly when the
CTA/no-CTA decision needs to be made — adding it here (rather than only in
the Workflow paragraph) makes it apply regardless of whether the closing
slide is schema/componentId-sourced or the hand-coded `closing` layout.

## Edit 3 — slide-97 example caption (~line 231, supporting edit)

**Before:**
> Swap `"Thank you!"` for a real closing line (or a CTA); the right-hand
> block of warm-toned rects is a decorative collage — leave it as-is.

**After:**
> Swap `"Thank you!"` for a real closing line — per Content Rule 6 above,
> only make it a CTA if the deck's actual purpose calls for one (e.g. a
> sales/pitch deck), otherwise keep it a plain thank-you/summary line; the
> right-hand block of warm-toned rects (none of which are text — this
> variant has no baked-in CTA copy, just decorative color blocks) is a
> decorative collage — leave it as-is.

Why: this was the literal spot that told the model "(or a CTA)" with no
condition — left unedited, Edit 1 and Edit 2 could be undermined by this
one line. Also clarifies precisely (per the JSON cross-check above) that
none of `slide-97`'s shape elements are actual CTA text/copy — they're
decorative rects — so future readers don't mistake the ~2.29×0.83in rect
for a baked-in "book a demo" button.

## Cross-reference check

- Line 162 ("the 'Practical examples' subsection right after the Workflow
  paragraph") — still accurate; paragraph position and section order
  unchanged.
- The category table above the Workflow paragraph (title/section/
  agenda/closing ranges) — untouched, still consistent with the rewritten
  Workflow paragraph's ranges.
- No other file references the old Workflow wording or the old slide-97
  caption text.

## Status

Documentation-only change, no automated tests applicable. Verified by
re-reading the full "Schema Layout & the Master Deck Library" section
post-edit: the Workflow paragraph no longer defaults to the single
embedded example, Content Rule 6 is clear and matches the section's
existing tone/numbering, and no cross-references were broken.
