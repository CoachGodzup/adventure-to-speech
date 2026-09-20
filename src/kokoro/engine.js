/* Adventure To Speech - Kokoro engine (shared, host-agnostic).
 *
 * Used in-process by the game-tab content script (synthesis + playback) and
 * by the options page (preload + status). No chrome or browser namespace
 * dependency: the host wires progress reporting via onProgress.
 *
 * PROTOTYPE: loads kokoro-js + Kokoro-82M q8 weights from CDN/HuggingFace on
 * first use (~85MB, then cached offline). All synthesis runs locally; game
 * text never leaves the device. Remote code must be vendored before any
 * store release (see docs/08-kokoro.md).
 *
 * Notes:
 * - Kokoro v1 voices are English-only (af/am American, bf/bm British).
 * - Each host context (game tab, options page) loads and caches the model
 *   separately: the model may download once per site.
 * - WebAudio autoplay policy may keep audio silent until the user has
 *   interacted with the page; callers must ensure a prior user gesture.
 */

const KOKORO_ESM_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const MODEL_DTYPE = 'q8'; // ~85MB, recommended quality/size trade-off

export function createKokoroEngine({ onProgress } = {}) {
  let ttsPromise = null;
  let loaded = false;
  let audioCtx = null;
  let currentSource = null;
  let jobId = 0;

  function report(p) {
    try { onProgress?.(p || null); } catch (e) {}
  }

  function load() {
    if (!ttsPromise) {
      ttsPromise = (async () => {
        const { KokoroTTS } = await import(KOKORO_ESM_URL);
        const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: MODEL_DTYPE,
          device: 'wasm',
          progress_callback: report
        });
        loaded = true;
        return tts;
      })();
      ttsPromise.catch(() => { ttsPromise = null; loaded = false; });
    }
    return ttsPromise;
  }

  function stopSource() {
    if (currentSource) {
      try { currentSource.onended = null; currentSource.stop(); } catch (e) {}
      currentSource = null;
    }
  }

  function play(samples, sampleRate, volume, job) {
    return new Promise((resolve, reject) => {
      try {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return reject(new Error('WebAudio unavailable'));
        audioCtx = audioCtx || new AC();
        const start = () => {
          if (job !== jobId) return resolve('stopped'); // stopped while resuming
          stopSource();
          const buf = audioCtx.createBuffer(1, samples.length, sampleRate);
          buf.getChannelData(0).set(samples);
          const gain = audioCtx.createGain();
          gain.gain.value = Math.min(1, Math.max(0, volume));
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(gain);
          gain.connect(audioCtx.destination);
          currentSource = src;
          src.onended = () => {
            if (currentSource === src) currentSource = null;
            resolve(job === jobId ? 'ended' : 'stopped');
          };
          src.start();
        };
        if (audioCtx.state === 'suspended') audioCtx.resume().then(start).catch(reject);
        else start();
      } catch (e) {
        reject(e);
      }
    });
  }

  return {
    preload() {
      return load().then(() => true);
    },
    status() {
      return Promise.resolve({ loaded, loading: !!ttsPromise && !loaded });
    },
    // Resolves 'ended' on natural playback end, 'stopped' if superseded.
    async speak({ text, voice, speed, volume }) {
      const job = ++jobId;
      const tts = await load();
      if (job !== jobId) return 'stopped';
      const out = await tts.generate(String(text || ''), {
        voice: voice || 'af_heart',
        speed: Math.min(2, Math.max(0.5, Number(speed) || 1))
      });
      if (job !== jobId) return 'stopped';
      return play(out.audio, out.sampling_rate, volume ?? 1, job);
    },
    stop() {
      jobId++;
      stopSource();
    }
  };
}
