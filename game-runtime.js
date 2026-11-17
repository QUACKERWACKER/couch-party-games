'use strict';

function physicalGamepads() {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter(pad => pad?.connected);
  } catch {
    // Keep keyboard and phone input available when gamepad access is blocked.
    return null;
  }
}

function gameControllerInputs() {
  const pads = physicalGamepads() ?? [];
  if (window.couchJoinstick) pads.push(...window.couchJoinstick.sample());
  return pads;
}

function playGameTone(audio, frequency, duration, type, volume, delay = 0, end = frequency, attack = 0) {
  if (audio?.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + delay;
  const stop = start + duration;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (end !== frequency) oscillator.frequency.exponentialRampToValueAtTime(end, stop);
  gain.gain.setValueAtTime(attack ? .001 : volume, start);
  if (attack) gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(.001, stop);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(stop + (attack ? .01 : 0));
}

function gameElement(tag, {text, className} = {}) {
  const node = document.createElement(tag);
  if (tag === 'button') node.type = 'button';
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function gameTableCells([heading, ...values], className) {
  const header = gameElement('th', {text: heading, className});
  header.scope = 'row';
  return [header, ...values.map(text => gameElement('td', {text}))];
}

function updateGameText(node, value) {
  const text = String(value);
  if (node.textContent !== text) node.textContent = text;
}
