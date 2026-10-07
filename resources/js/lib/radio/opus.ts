/** Bitrate cap negotiated for the live link; the console lowers it to VOICE_BITRATE while only a voice is on air. */
export const MUSIC_BITRATE = 192_000;

export const VOICE_BITRATE = 64_000;

/** Opus packet length: 10 ms instead of the default 20 ms halves the packetization delay. */
const PTIME_MS = 10;

/**
 * Rewrites the Opus line of an SDP for the live link: stereo, the music bitrate, in-band error
 * correction instead of retransmissions, no silence suppression (it adds wake-up delay) and 10 ms
 * packets. The answer of each listener carries it, which is what the console's encoder follows.
 */
export function tuneOpus(sdp: string): string {
  const rtpmap = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp);
  if (!rtpmap) return sdp;
  const payload = rtpmap[1];
  const wanted: Record<string, string> = {
    minptime: String(PTIME_MS),
    useinbandfec: "1",
    usedtx: "0",
    stereo: "1",
    "sprop-stereo": "1",
    maxaveragebitrate: String(MUSIC_BITRATE),
    maxplaybackrate: "48000",
  };
  const fmtp = new RegExp(`a=fmtp:${payload} ([^\\r\\n]*)`);
  const current = fmtp.exec(sdp);
  const params = new Map<string, string>();
  current?.[1].split(";").forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key?.trim()) params.set(key.trim(), (value ?? "").trim());
  });
  Object.entries(wanted).forEach(([key, value]) => params.set(key, value));
  const line = `a=fmtp:${payload} ${[...params].map(([key, value]) => `${key}=${value}`).join(";")}`;
  let next = current ? sdp.replace(fmtp, line) : sdp.replace(rtpmap[0], `${rtpmap[0]}\r\n${line}`);
  if (!/a=ptime:/.test(next)) next = next.replace(line, `${line}\r\na=ptime:${PTIME_MS}`);
  return next;
}

type TunableReceiver = { jitterBufferTarget?: number | null; playoutDelayHint?: number | null };

/** Asks the browser to keep the jitter buffer as short as the network allows (it still grows when packets arrive late). */
export function shortJitterBuffer(receiver: RTCRtpReceiver): void {
  const tunable = receiver as unknown as TunableReceiver;
  try {
    if ("jitterBufferTarget" in receiver) tunable.jitterBufferTarget = 0;
    else tunable.playoutDelayHint = 0;
  } catch {
    // Older browsers reject the hint; the default adaptive buffer stays.
  }
}

type PriorityEncoding = RTCRtpEncodingParameters & { priority?: "very-low" | "low" | "medium" | "high"; networkPriority?: "very-low" | "low" | "medium" | "high" };

/** Caps the bitrate of an audio sender and marks its packets as urgent for the network. */
export async function tuneSender(sender: RTCRtpSender, bitrate: number): Promise<void> {
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    const encoding = params.encodings[0] as PriorityEncoding;
    encoding.maxBitrate = bitrate;
    encoding.priority = "high";
    encoding.networkPriority = "high";
    await sender.setParameters(params);
  } catch {
    // Without setParameters the bitrate negotiated in the SDP applies.
  }
}
