require('../icons.js');

describe('DeckIcons.getIcon', () => {
  it('returns svg markup for a known icon name', () => {
    const icon = window.DeckIcons.getIcon('check');
    expect(icon).not.toBeNull();
    expect(icon.svg).toContain('<path');
    expect(icon.viewBox).toBe('0 0 24 24');
  });

  it('returns null for an unknown icon name', () => {
    expect(window.DeckIcons.getIcon('not-a-real-icon')).toBeNull();
  });

  it('lists all 12 curated icons', () => {
    expect(window.DeckIcons.ICON_NAMES.length).toBe(12);
  });
});
