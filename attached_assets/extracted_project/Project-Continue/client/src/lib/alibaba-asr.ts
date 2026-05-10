export interface ASRCallbacks {
  onStart?: () => void;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

const TARGET_SAMPLE_RATE = 16000;

function resample(inputData: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) {
    return inputData;
  }

  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(inputData.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
    const fraction = srcIndex - srcIndexFloor;
    output[i] = inputData[srcIndexFloor] * (1 - fraction) + inputData[srcIndexCeil] * fraction;
  }

  return output;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

export class AlibabaASR {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private callbacks: ASRCallbacks = {};
  private isStarted = false;
  private actualSampleRate = 48000;

  constructor(callbacks: ASRCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/asr`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("[ASR] WebSocket connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "started":
              console.log("[ASR] Recognition started");
              this.isStarted = true;
              this.startAudioCapture();
              this.callbacks.onStart?.();
              break;

            case "result":
              this.callbacks.onResult?.(data.text, data.isFinal);
              break;

            case "error":
              console.error("[ASR] Error:", data.message);
              this.callbacks.onError?.(data.message);
              break;

            case "finished":
              console.log("[ASR] Recognition finished");
              this.cleanup();
              this.callbacks.onEnd?.();
              break;
          }
        } catch (error) {
          console.error("[ASR] Message parse error:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[ASR] WebSocket error:", error);
        this.callbacks.onError?.("Connection error");
      };

      this.ws.onclose = () => {
        console.log("[ASR] WebSocket closed");
        if (this.isStarted) {
          this.cleanup();
          this.callbacks.onEnd?.();
        }
      };
    } catch (error) {
      console.error("[ASR] Start error:", error);
      this.callbacks.onError?.("Failed to start");
    }
  }

  private async startAudioCapture(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext();
      this.actualSampleRate = this.audioContext.sampleRate;
      console.log(`[ASR] Actual sample rate: ${this.actualSampleRate}, will resample to ${TARGET_SAMPLE_RATE}`);

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isStarted) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const resampled = resample(inputData, this.actualSampleRate);
        const pcmData = floatTo16BitPCM(resampled);

        this.ws.send(pcmData.buffer);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log("[ASR] Audio capture started with resampling");
    } catch (error) {
      console.error("[ASR] Audio capture error:", error);
      this.callbacks.onError?.("Microphone access failed");
    }
  }

  stop(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "stop" }));
    }
    this.isStarted = false;
  }

  private cleanup(): void {
    this.isStarted = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  destroy(): void {
    this.stop();
    this.cleanup();
  }
}
