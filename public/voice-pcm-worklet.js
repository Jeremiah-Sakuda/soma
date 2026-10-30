// Original PCM capture processor. AudioContext runs at 24 kHz; no audio storage.
class SomaPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(1920);
    this.used = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'flush') {
        this.flush();
        this.port.postMessage({ type: 'flushed' });
      }
    };
  }
  flush() {
    if (!this.used) return;
    const copy = this.samples.slice(0, this.used);
    this.port.postMessage({ type: 'pcm', bytes: copy.buffer }, [copy.buffer]);
    this.used = 0;
  }
  process(inputs, outputs) {
    const channels = inputs[0];
    if (channels?.length) {
      for (let i = 0; i < channels[0].length; i++) {
        let v = 0;
        for (const c of channels) v += c[i];
        v = Math.max(-1, Math.min(1, v / channels.length));
        this.samples[this.used++] = Math.round(v * (v < 0 ? 32768 : 32767));
        if (this.used === this.samples.length) this.flush();
      }
    }
    for (const o of outputs) for (const c of o) c.fill(0);
    return true;
  }
}
registerProcessor('soma-pcm', SomaPcm);
