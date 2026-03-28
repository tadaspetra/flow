class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input) return true;

    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(input[i]! * 32767)));
    }
    this.port.postMessage({ pcm: pcm.buffer }, [pcm.buffer]);
    return true;
  }
}

registerProcessor('audio-capture', AudioCaptureProcessor);
