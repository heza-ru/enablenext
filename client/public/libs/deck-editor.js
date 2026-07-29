// Structured editor for LLM-generated decks: inline text editing, mutating
// window.DECK directly (single-source-of-truth discipline shared with the
// rest of this renderer). Layout/variant swap, reorder/duplicate/delete,
// and the brand-image picker are added in Task 8; this file lays the
// contenteditable + commit-on-blur foundation both build on.
//
// Scoping note: inline editing is wired up only for `.schema-text` elements
// (the new 'schema' layout, Task 2) and any element explicitly tagged with
// `data-deck-field` by a hand-coded layout. Retrofitting `data-deck-field`
// annotations onto all 19 pre-existing hand-coded layouts' bespoke DOM
// structures is out of scope for this task and left as a separable
// follow-up (see task-7-report.md).
(function () {
  var editing = false;
  var boundHandlers = []; // { el, handler } pairs, so disableEditing can remove exactly what enableEditing added

  function commitHandlerFor(slideIndex, elementIndex, el) {
    return function () {
      var deck = window.DECK;
      if (!deck || !deck.slides || !deck.slides[slideIndex]) return;
      var slide = deck.slides[slideIndex];
      if (slide.elements && slide.elements[elementIndex]) {
        slide.elements[elementIndex].text = el.textContent;
      }
    };
  }

  function enableEditing(mountEl) {
    // Clear any bindings left over from a prior enableEditing call (e.g. a
    // previous mount that was never explicitly disabled) before wiring up
    // this mountEl, so re-invoking enableEditing is always idempotent and
    // never silently no-ops against stale elements.
    disableEditing();
    editing = true;
    var slideEls = mountEl.querySelectorAll('.slide');
    slideEls.forEach(function (slideEl, slideIndex) {
      var textEls = slideEl.querySelectorAll('.schema-text, [data-deck-field]');
      textEls.forEach(function (el, elementIndex) {
        el.setAttribute('contenteditable', 'true');
        el.dataset.slideIndex = String(slideIndex);
        el.dataset.elementIndex = String(elementIndex);
        var handler = commitHandlerFor(slideIndex, elementIndex, el);
        el.addEventListener('blur', handler);
        boundHandlers.push({ el: el, handler: handler });
      });
    });
  }

  function disableEditing(mountEl) {
    // mountEl is accepted (per the documented signature) but unused: we
    // track exactly which elements were bound in boundHandlers regardless of
    // which mount they came from, so no re-derivation from mountEl is
    // needed to reverse enableEditing.
    boundHandlers.forEach(function (pair) {
      pair.el.removeAttribute('contenteditable');
      pair.el.removeEventListener('blur', pair.handler);
    });
    boundHandlers = [];
    editing = false;
  }

  function isEditing() {
    return editing;
  }

  function getDeck() {
    return window.DECK;
  }

  function reorderSlide(fromIndex, toIndex, mountEl) {
    var slides = window.DECK.slides;
    var moved = slides.splice(fromIndex, 1)[0];
    slides.splice(toIndex, 0, moved);
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  function duplicateSlide(index, mountEl) {
    var slides = window.DECK.slides;
    var copy = JSON.parse(JSON.stringify(slides[index]));
    slides.splice(index + 1, 0, copy);
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  function deleteSlide(index, mountEl) {
    window.DECK.slides.splice(index, 1);
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  function setSlideImage(slideIndex, elementIndex, imageRef, mountEl) {
    var el = window.DECK.slides[slideIndex].elements[elementIndex];
    if (!el || el.type !== 'image') {
      throw new Error('DeckEditor.setSlideImage: target element is not an image element');
    }
    delete el.brandImage;
    delete el.deckAsset;
    if (imageRef.brandImage) el.brandImage = imageRef.brandImage;
    if (imageRef.deckAsset) el.deckAsset = imageRef.deckAsset;
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  window.DeckEditor = {
    enableEditing: enableEditing,
    disableEditing: disableEditing,
    isEditing: isEditing,
    getDeck: getDeck,
    reorderSlide: reorderSlide,
    duplicateSlide: duplicateSlide,
    deleteSlide: deleteSlide,
    setSlideImage: setSlideImage,
  };
})();
