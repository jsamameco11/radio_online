/** Offset between this device and the server clock, from the sample with the lowest latency. */
export class ServerClock {
  private offset = 0;
  private best = Infinity;

  /** First rough estimate (from page props), replaced by the first measured sample. */
  seed(serverNow: number): void {
    if (this.best === Infinity) this.offset = serverNow - Date.now();
  }

  sample(serverNow: number, sentAt: number, receivedAt: number): void {
    const rtt = receivedAt - sentAt;
    if (rtt <= this.best * 1.5 + 20) {
      this.best = Math.min(this.best, rtt);
      this.offset = serverNow + rtt / 2 - receivedAt;
    }
  }

  now(): number {
    return Date.now() + this.offset;
  }
}

/** Id a player draws when it starts: it names its listening session and its live-microphone connection. */
export function newListenerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16));
}
