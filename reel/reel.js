// Reel mode: open any animation with ?reel to get a 1080x1920 stage that plays itself on a loop,
// so a plain screen recording (macOS: Cmd+Shift+5) becomes an Instagram reel.
// Open with ?autoplay to loop the scripted demo without the reel frame.

const params = new URLSearchParams(location.search);
export const isReel = params.has('reel');
export const isAutoplay = isReel || params.has('autoplay');

const HANDLE = '@arslanagayev.dev';
const AVATAR = new URL('./avatar.png', import.meta.url).href;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once condition() is true (polled), so scripted demos follow the real animation timing. */
export async function waitFor(condition, timeout = 10000) {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout) return;
    await sleep(80);
  }
}

/** Minimal JS/CSS highlighter: escapes HTML and wraps tokens in coloured spans. */
export function highlight(code) {
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pattern =
    /(\/\/.*$|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(const|let|var|function|return|if|else|for|of|in|await|async|new|class|this|true|false|null|import|from|export|while|break|continue)\b|(\b\d+(?:\.\d+)?(?:ms|s|px|deg|%)?)|([A-Za-z_$][\w$-]*)(?=\()|(\.[A-Za-z_$][\w$-]*|--[\w-]+)/gm;
  let out = '';
  let last = 0;
  for (const m of code.matchAll(pattern)) {
    out += escape(code.slice(last, m.index));
    const [text, comment, string, keyword, number, fn] = m;
    const cls = comment ? 'c' : string ? 's' : keyword ? 'k' : number ? 'n' : fn ? 'f' : 'p';
    out += `<span class="tk-${cls}">${escape(text)}</span>`;
    last = m.index + text.length;
  }
  return out + escape(code.slice(last));
}

/** Fake mouse cursor that glides to elements and "clicks" them, for scripted demos. */
function createCursor(stage) {
  const el = document.createElement('div');
  el.className = 'reel-cursor';
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="#fff" stroke="#0b0d24" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  stage.append(el);
  let scale = 1;
  const toStage = (rect, stageRect) => ({
    x: (rect.left + rect.width / 2 - stageRect.left) / scale,
    y: (rect.top + rect.height / 2 - stageRect.top) / scale,
  });
  return {
    setScale(s) { scale = s; },
    async moveTo(target, { dx = 0, dy = 0 } = {}) {
      const p = toStage(target.getBoundingClientRect(), stage.getBoundingClientRect());
      el.style.transform = `translate(${p.x + dx}px, ${p.y + dy}px)`;
      await sleep(750);
    },
    async click(target) {
      if (target) await this.moveTo(target);
      el.classList.remove('press');
      void el.offsetWidth; // restart the ripple animation
      el.classList.add('press');
      target?.click();
      await sleep(250);
    },
    park() { el.style.transform = 'translate(980px, 1500px)'; },
  };
}

/** Types text into an input one character at a time, firing input events like a user would. */
export async function typeInto(input, text, delay = 260) {
  for (const ch of text) {
    input.focus();
    input.value = ch;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(delay);
  }
}

/**
 * Turns the page into a reel when ?reel is present.
 * @param {object} opts
 * @param {string} opts.eyebrow   small label above the title, e.g. "UI animation #01"
 * @param {string} opts.title     first line of the title
 * @param {string} opts.accent    second line, rendered with the brand gradient
 * @param {HTMLElement} opts.demo the component to showcase
 * @param {string} opts.file      file name shown in the code window
 * @param {string} opts.code      code excerpt shown in the code window
 * @param {(api) => Promise<void>} opts.play  scripted demo; api = { cursor, sleep, typeInto, waitFor }
 * @param {() => void} [opts.reset] restores the component to its start state between loops
 * @param {number} [opts.demoScale]
 */
export function mountReel({ eyebrow, title, accent, demo, file, code, play, reset, demoScale }) {
  if (!isAutoplay) return;

  let stage = document.body;
  if (!isReel) document.body.classList.add('autoplay'); // gallery previews: hide page chrome
  if (isReel) {
    document.body.classList.add('reel');
    stage = document.createElement('div');
    stage.className = 'reel-stage';
    stage.innerHTML = `
      <div class="reel-title">
        <div class="reel-eyebrow">${eyebrow}</div>
        <h1>${title}<br><span>${accent}</span></h1>
      </div>
      <div class="reel-demo"></div>
      <div class="reel-code"><header><i></i><i></i><i></i>${file}</header><pre>${highlight(code.trim())}</pre></div>
      <div class="reel-handle"><img src="${AVATAR}" alt="">${HANDLE}</div>
      <div class="reel-outro" aria-hidden="true">
        <img src="${AVATAR}" alt="">
        <strong>${HANDLE}</strong>
        <p>Follow for a new UI animation every week</p>
        <p>Comment <b style="color:#6fe9ff">"code"</b> to get the source</p>
      </div>`;
    stage.querySelector('.reel-demo').append(demo);
    document.body.replaceChildren(stage);
  }

  const cursor = createCursor(stage);
  const area = stage.querySelector('.reel-demo');
  const fit = () => {
    if (!isReel) return;
    const s = Math.min(innerWidth / 1080, innerHeight / 1920);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    cursor.setScale(s);
    // Scale the demo to fill the space between the title and the code window.
    const fitScale = Math.min(
      demoScale ?? 1.6,
      (area.clientWidth * 0.9) / demo.offsetWidth,
      (area.clientHeight * 0.94) / demo.offsetHeight,
    );
    stage.style.setProperty('--demo-scale', fitScale.toFixed(3));
  };
  fit();
  addEventListener('resize', fit);

  const outro = stage.querySelector('.reel-outro');
  (async () => {
    for (;;) {
      cursor.park();
      await sleep(900);
      await play({ cursor, sleep, typeInto, waitFor });
      if (outro) {
        await sleep(600);
        outro.classList.add('show');
        await sleep(2600);
        outro.classList.remove('show');
      } else {
        await sleep(1800);
      }
      reset?.();
      await sleep(700);
    }
  })();
}
