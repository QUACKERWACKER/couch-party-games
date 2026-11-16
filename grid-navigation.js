'use strict';

window.couchGrid = {
  direction(x, y) {
    if (Math.max(Math.abs(x), Math.abs(y)) <= .55) return null;
    return Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
  },

  next(cards, selected, direction) {
    const current = cards[selected]?.getBoundingClientRect();
    if (!current?.width || !current.height) return selected;
    const horizontal = direction === 'left' || direction === 'right';
    const forward = direction === 'right' || direction === 'down';
    const [start, end, crossStart, crossEnd] = horizontal
      ? ['left', 'right', 'top', 'bottom'] : ['top', 'bottom', 'left', 'right'];
    let best = null;

    cards.forEach((card, index) => {
      if (index === selected || card.disabled || card.hidden) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const gap = forward ? rect[start] - current[end] : current[start] - rect[end];
      if (gap < -1) return;
      const aligned = rect[crossEnd] > current[crossStart] && rect[crossStart] < current[crossEnd];
      // With no neighbor in this row, leave the selection at the edge.
      if (horizontal && !aligned) return;
      const offset = Math.abs(rect[crossStart] + rect[crossEnd] - current[crossStart] - current[crossEnd]) / 2;
      if (!best || gap < best.gap - 1 || (Math.abs(gap - best.gap) <= 1 && offset < best.offset)) {
        best = {index, gap, offset};
      }
    });
    return best?.index ?? selected;
  },
};
