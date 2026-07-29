// Bounded, curated inline-SVG icon set for icon_grid. Deliberately NOT an
// arbitrary icon-name lookup against an external service (e.g. a CDN icon
// font) -- every artifact must render standalone, offline, with no network
// dependency beyond this file. All paths are simple, single-color, 24x24
// viewBox strokes so they tint correctly against the orange accent color.
(function () {
  var ICONS = {
    check: '<path d="M20 6L9 17l-5-5" stroke="currentColor" fill="none" stroke-width="2"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" fill="none" stroke-width="2"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" fill="none" stroke-width="2"/>',
    chart: '<path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" fill="none" stroke-width="2"/>',
    target: '<circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" fill="none" stroke-width="2"/>',
    lightbulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" stroke="currentColor" fill="none" stroke-width="2"/>',
    shield: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" stroke="currentColor" fill="none" stroke-width="2"/>',
    users: '<circle cx="9" cy="8" r="3" stroke="currentColor" fill="none" stroke-width="2"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 8a3 3 0 1 1 4 2.8M17 14c2.5.3 5 2 5 6" stroke="currentColor" fill="none" stroke-width="2"/>',
    globe: '<circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z" stroke="currentColor" fill="none" stroke-width="2"/>',
    gear: '<circle cx="12" cy="12" r="3" stroke="currentColor" fill="none" stroke-width="2"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.3-.9c.6.5 1.3.9 2.1 1.2L10 21h4l.5-2.5a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" stroke="currentColor" fill="none" stroke-width="1.5"/>',
    flag: '<path d="M5 21V4M5 4h13l-3 4 3 4H5" stroke="currentColor" fill="none" stroke-width="2"/>',
  };
  var NAMES = Object.keys(ICONS);

  function getIcon(name) {
    if (!ICONS[name]) return null;
    return { svg: ICONS[name], viewBox: '0 0 24 24' };
  }

  window.DeckIcons = {
    getIcon: getIcon,
    ICON_NAMES: NAMES,
  };
})();
