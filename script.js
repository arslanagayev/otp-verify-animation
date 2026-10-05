import { mountReel, sleep } from './reel/reel.js';

const DEMO_CODE = '2026';
const ORBIT = { rx: 112, ry: 22 }; // flat ellipse that stays inside the digit row
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const card = document.querySelector('.otp-card');
const form = card.querySelector('.otp-form');
const row = card.querySelector('.otp-inputs');
const inputs = [...card.querySelectorAll('.otp-digit')];
const fx = card.querySelector('.otp-fx');
const badge = card.querySelector('.otp-badge');
const submit = card.querySelector('.otp-submit');
const label = card.querySelector('.otp-label');
const title = card.querySelector('.otp-title');
const sub = card.querySelector('.otp-sub');
const status = card.querySelector('.otp-status');
const resend = card.querySelector('.otp-resend-btn');
const timer = card.querySelector('.otp-timer');

const initial = { title: title.innerHTML, sub: sub.innerHTML };
const code = () => inputs.map((input) => input.value).join('');
const setState = (state) => { card.dataset.state = state; syncButton(); };

function syncButton() {
  const busy = card.dataset.state === 'verifying' || card.dataset.state === 'success';
  submit.disabled = busy || code().length !== inputs.length;
}

function setDigit(input, value) {
  input.value = value;
  input.classList.toggle('filled', value !== '');
}

/* ---------- Input behaviour: auto-advance, backspace, arrows, paste ---------- */

inputs.forEach((input, i) => {
  input.addEventListener('input', () => {
    setDigit(input, input.value.replace(/\D/g, '').slice(-1));
    if (input.value && inputs[i + 1]) inputs[i + 1].focus();
    syncButton();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && inputs[i - 1]) {
      event.preventDefault();
      setDigit(inputs[i - 1], '');
      inputs[i - 1].focus();
      syncButton();
    } else if (event.key === 'ArrowLeft' && inputs[i - 1]) {
      inputs[i - 1].focus();
    } else if (event.key === 'ArrowRight' && inputs[i + 1]) {
      inputs[i + 1].focus();
    }
  });

  input.addEventListener('paste', (event) => {
    const digits = (event.clipboardData.getData('text').match(/\d/g) ?? []).slice(0, inputs.length);
    if (!digits.length) return;
    event.preventDefault();
    digits.forEach((digit, j) => setDigit(inputs[j], digit));
    inputs[digits.length - 1].focus();
    syncButton();
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!submit.disabled) verify();
});

/* ---------- Resend countdown ---------- */

let countdown;
function startCountdown(seconds = 30) {
  clearInterval(countdown);
  resend.disabled = true;
  resend.firstChild.textContent = 'Resend in ';
  const tick = () => {
    timer.textContent = `0:${String(seconds).padStart(2, '0')}`;
    if (seconds-- === 0) {
      clearInterval(countdown);
      resend.disabled = false;
      resend.firstChild.textContent = 'Resend code';
      timer.textContent = '';
    }
  };
  tick();
  countdown = setInterval(tick, 1000);
}

resend.addEventListener('click', () => {
  status.textContent = 'A new code is on its way.';
  startCountdown();
});

/* ---------- The animation: digits orbit into a spinner ---------- */

async function orbitDigits() {
  const cardBox = card.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  // getBoundingClientRect includes CSS transforms (reel mode scales the card), so undo the scale.
  const scale = cardBox.width / card.offsetWidth;
  const cx = (rowBox.left + rowBox.width / 2 - cardBox.left) / scale;
  const cy = (rowBox.top + rowBox.height / 2 - cardBox.top) / scale;

  const orbit = document.createElement('div');
  orbit.className = 'otp-orbit';
  orbit.style.left = `${cx}px`;
  orbit.style.top = `${cy}px`;
  fx.append(orbit);

  const chips = inputs.map((input, i) => {
    const box = input.getBoundingClientRect();
    const chip = document.createElement('span');
    chip.className = 'otp-chip';
    chip.textContent = input.value;
    orbit.append(chip);
    input.classList.add('emptied');

    const angle = Math.PI - (i / inputs.length) * Math.PI * 2; // left, back, right, front
    return {
      chip,
      angle,
      from: {
        x: (box.left + box.width / 2 - cardBox.left) / scale - cx,
        y: (box.top + box.height / 2 - cardBox.top) / scale - cy,
      },
    };
  });

  // 1. Each digit lifts out of its box and flies to its slot on the orbit.
  await Promise.all(chips.map(({ chip, from, angle }, i) =>
    chip.animate([
      { transform: `translate(${from.x}px, ${from.y}px) scale(1)`, opacity: 1 },
      { transform: `translate(${from.x}px, ${from.y - 34}px) scale(1.15)`, opacity: 1, offset: 0.35 },
      spiralFrames(angle)[0], // land exactly where the spiral starts
    ], { duration: 620, delay: i * 70, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).finished,
  ));

  // 2. The digits circle a tilted orbit, speeding up and spiralling into the centre.
  await Promise.all(chips.map(({ chip, angle }) =>
    chip.animate(spiralFrames(angle), { duration: 1400, fill: 'forwards' }).finished,
  ));
  orbit.remove();
}

/**
 * Keyframes for one digit spiralling inward on a flat ellipse. Digits passing the front of the
 * orbit grow and brighten, digits at the back shrink and dim, which reads as 3D depth.
 */
function spiralFrames(startAngle, steps = 36, turns = 2) {
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = t * t * (3 - 2 * t);            // smoothstep: slow start, fast middle
    const angle = startAngle - eased * turns * Math.PI * 2;
    const shrink = 1 - eased;                      // radius collapses to the centre
    const depth = Math.sin(angle);                 // +1 = front of the orbit, -1 = back
    frames.push({
      transform: `translate(${Math.cos(angle) * ORBIT.rx * shrink}px, ${depth * ORBIT.ry * shrink}px)
                  scale(${(0.82 + 0.22 * depth) * (0.3 + 0.7 * shrink)})`,
      opacity: (0.65 + 0.35 * depth) * (t > 0.8 ? (1 - t) / 0.2 : 1),
    });
  }
  return frames;
}

function burstSparks() {
  for (let i = 0; i < 12; i++) {
    const spark = document.createElement('span');
    spark.className = 'otp-spark';
    badge.append(spark);
    const angle = (i / 12) * Math.PI * 2;
    const distance = 70 + Math.random() * 30;
    spark.animate([
      { transform: 'translate(36px, 36px) scale(1)', opacity: 1 },
      { transform: `translate(${36 + Math.cos(angle) * distance}px, ${36 + Math.sin(angle) * distance}px) scale(0)`, opacity: 0 },
    ], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' }).finished.then(() => spark.remove());
  }
}

// Stand-in for a real API call.
async function checkCode(value) {
  await sleep(600);
  return value === DEMO_CODE;
}

async function verify() {
  setState('verifying');
  label.textContent = 'Verifying…';
  status.textContent = 'Checking your code…';

  const result = checkCode(code());
  if (!reducedMotion) await orbitDigits();
  badge.className = 'otp-badge spinning';
  const ok = await result;
  await sleep(450);

  if (ok) {
    badge.className = 'otp-badge ok';
    if (!reducedMotion) burstSparks();
    setState('success');
    title.innerHTML = 'Verified <span>successfully</span>';
    sub.textContent = 'Your identity is confirmed. Welcome back!';
    label.textContent = 'Verified';
    status.textContent = 'Code verified.';
    clearInterval(countdown);
  } else {
    badge.className = 'otp-badge error';
    setState('error');
    label.textContent = 'Verify code';
    status.textContent = "That code didn't match. Try again.";
    await sleep(900);
    resetInputs();
    inputs[0].focus();
  }
}

function resetInputs() {
  inputs.forEach((input) => { setDigit(input, ''); input.classList.remove('emptied'); });
  badge.className = 'otp-badge';
  if (card.dataset.state !== 'success') setState('idle');
}

function reset() {
  fx.replaceChildren();
  setState('idle');
  resetInputs();
  title.innerHTML = initial.title;
  sub.innerHTML = initial.sub;
  label.textContent = 'Verify code';
  status.textContent = '';
  startCountdown();
}

startCountdown();

/* ---------- Reel mode: a scripted run for screen recording ---------- */

mountReel({
  eyebrow: 'UI animation #01',
  title: 'Glassy OTP',
  accent: 'Verification',
  demo: card,
  file: 'otp-verify-animation/script.js',
  demoScale: 1.6,
  code: `
// Each digit spirals inward on a tilted orbit
for (let i = 0; i <= steps; i++) {
  const t = smoothstep(i / steps);
  const angle = start - t * turns * Math.PI * 2;
  const r = 1 - t;                  // collapse to centre
  const depth = Math.sin(angle);    // front = +1, back = -1
  frames.push({
    transform: \`translate(\${Math.cos(angle) * rx * r}px,
      \${depth * ry * r}px) scale(\${0.82 + 0.22 * depth})\`,
    opacity: 0.65 + 0.35 * depth,
  });
}
chip.animate(frames, { duration: 1400 });`,
  reset,
  async play({ cursor, sleep, typeInto, waitFor }) {
    await cursor.click(inputs[0]);
    for (let i = 0; i < DEMO_CODE.length; i++) await typeInto(inputs[i], DEMO_CODE[i], 280);
    await sleep(250);
    await cursor.click(submit);
    await waitFor(() => card.dataset.state === 'success');
    await sleep(1600);
  },
});
