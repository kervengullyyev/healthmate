declare global {
  interface Window {
    voiceTest: {
      resolve: () => void;
      stopped: number;
      closed: boolean;
      closes: number;
      speaking: boolean;
      message: (role: "user" | "assistant", text: string) => void;
    };
  }
}

export async function fakeVoice(
  page: import("@playwright/test").Page,
  delayed: boolean,
  withSpeaking = false,
) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { liveConfigured: true } }),
  );
  await page.addInitScript(
    ({ delayed, withSpeaking }) => {
      window.voiceTest = {
        resolve: () => {},
        stopped: 0,
        closed: false,
        closes: 0,
        speaking: false,
        message: () => {},
      };
      const track = { enabled: true, stop: () => window.voiceTest.stopped++ };
      const stream = {
        getTracks: () => [track],
        getAudioTracks: () => [track],
      };
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: () =>
            delayed
              ? new Promise((resolve) => {
                  window.voiceTest.resolve = () => resolve(stream);
                })
              : Promise.resolve(stream),
        },
      });
      if (withSpeaking) {
        class AudioElement {
          autoplay = false;
          srcObject: unknown = null;
          async play() {}
          pause() {}
        }
        class AudioAnalysis {
          createAnalyser() {
            return {
              fftSize: 256,
              getByteTimeDomainData(data: Uint8Array) {
                data.fill(window.voiceTest.speaking ? 160 : 128);
              },
            };
          }
          createMediaStreamSource() {
            return { connect() {} };
          }
          async resume() {}
          async close() {}
        }
        Object.defineProperty(window, "Audio", { value: AudioElement });
        Object.defineProperty(window, "AudioContext", { value: AudioAnalysis });
        Object.defineProperty(window, "MediaStream", { value: class {} });
      }
      class Channel extends EventTarget {
        readyState = "open";
        close() {}
        send(value: string) {
          if (JSON.parse(value).type === "session.close") {
            window.voiceTest.closes++;
            this.dispatchEvent(
              new MessageEvent("message", {
                data: JSON.stringify({ type: "session.closed" }),
              }),
            );
          }
        }
      }
      class Peer extends EventTarget {
        channel = new Channel();
        iceGatheringState = "complete";
        localDescription = { sdp: "v=0\r\n" };
        addTrack() {}
        createDataChannel() {
          return this.channel;
        }
        async createOffer() {
          return { type: "offer", sdp: "v=0\r\n" };
        }
        async setLocalDescription() {}
        async setRemoteDescription() {
          window.voiceTest.message = (role, text) => {
            this.channel.dispatchEvent(
              new MessageEvent("message", {
                data: JSON.stringify({
                  type:
                    role === "user"
                      ? "session.input_transcript.delta"
                      : "session.output_transcript.delta",
                  event_id: crypto.randomUUID(),
                  delta: text,
                  start_ms: role === "user" ? 100 : 500,
                  end_ms: role === "user" ? 400 : 900,
                }),
              }),
            );
          };
          if (withSpeaking) {
            const trackEvent = new Event("track");
            Object.defineProperty(trackEvent, "track", { value: {} });
            this.dispatchEvent(trackEvent);
          }
          this.channel.dispatchEvent(
            new MessageEvent("message", {
              data: JSON.stringify({ type: "session.started" }),
            }),
          );
        }
        close() {
          window.voiceTest.closed = true;
        }
      }
      Object.defineProperty(window, "RTCPeerConnection", { value: Peer });
    },
    { delayed, withSpeaking },
  );
}
