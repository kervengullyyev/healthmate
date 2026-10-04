declare global {
  interface Window {
    voiceTest: {
      resolve: () => void;
      stopped: number;
      closed: boolean;
      closes: number;
      speaking: boolean;
      userSpeaking: boolean;
      message: (role: "user" | "assistant", text: string) => void;
      tool: (name: string, args: unknown) => Promise<Record<string, unknown>>;
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
        userSpeaking: false,
        message: () => {},
        tool: async () => ({}),
      };
      const pendingTools = new Map<
        string,
        (result: Record<string, unknown>) => void
      >();
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
              input: false,
              fftSize: 256,
              getByteTimeDomainData(data: Uint8Array) {
                const talking = this.input
                  ? window.voiceTest.userSpeaking && track.enabled
                  : window.voiceTest.speaking;
                data.fill(talking ? 160 : 128);
              },
            };
          }
          createMediaStreamSource(source: unknown) {
            return {
              connect(analyser: { input: boolean }) {
                analyser.input = source === stream;
              },
            };
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
          const event = JSON.parse(value);
          if (
            event.type === "response.item.create" &&
            event.item?.type === "function_call_output"
          ) {
            pendingTools.get(event.item.call_id)?.(
              JSON.parse(event.item.output),
            );
            pendingTools.delete(event.item.call_id);
          }
          if (event.type === "session.close") {
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
          let offset = 0;
          window.voiceTest.message = (role, text) => {
            offset += 3000;
            this.channel.dispatchEvent(
              new MessageEvent("message", {
                data: JSON.stringify({
                  type:
                    role === "user"
                      ? "session.input_transcript.delta"
                      : "session.output_transcript.delta",
                  event_id: crypto.randomUUID(),
                  delta: text,
                  start_ms: offset,
                  end_ms: offset + 500,
                }),
              }),
            );
          };
          window.voiceTest.tool = (name, args) =>
            new Promise((resolve, reject) => {
              const callId = crypto.randomUUID();
              const delegationId = crypto.randomUUID();
              const responseId = crypto.randomUUID();
              const timeout = setTimeout(() => {
                pendingTools.delete(callId);
                reject(new Error("No function result returned"));
              }, 3000);
              pendingTools.set(callId, (result) => {
                clearTimeout(timeout);
                resolve(result);
              });
              for (const event of [
                {
                  type: "response.created",
                  response: {
                    id: responseId,
                    status: "in_progress",
                    output: [],
                  },
                },
                {
                  type: "response.output_item.done",
                  sequence_number: 1,
                  output_index: 0,
                  item: {
                    id: crypto.randomUUID(),
                    type: "function_call",
                    status: "completed",
                    call_id: callId,
                    name,
                    arguments: JSON.stringify(args),
                  },
                },
                {
                  type: "response.completed",
                  response: {
                    id: responseId,
                    status: "completed",
                    output: [],
                    tools: [],
                    instructions: null,
                  },
                },
              ])
                this.channel.dispatchEvent(
                  new MessageEvent("message", {
                    data: JSON.stringify({
                      type: "response.event",
                      event_id: crypto.randomUUID(),
                      delegation_id: delegationId,
                      event,
                    }),
                  }),
                );
            });
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
