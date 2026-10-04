declare global {
  interface Window {
    voiceTest: {
      resolve: () => void;
      stopped: number;
      closed: boolean;
      closes: number;
    };
  }
}

export async function fakeVoice(
  page: import("@playwright/test").Page,
  delayed: boolean,
) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { liveConfigured: true } }),
  );
  await page.addInitScript((delayed) => {
    window.voiceTest = {
      resolve: () => {},
      stopped: 0,
      closed: false,
      closes: 0,
    };
    const track = { enabled: true, stop: () => window.voiceTest.stopped++ };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
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
  }, delayed);
}
