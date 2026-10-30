/** Ephemeral audio for one mounted exploration. Pending failures are retained
 * until interruption so a failed prefetch cannot silently trigger a paid retry. */
export class PreparedAudio {
  private completed = new Map<string, Blob>();
  private pending = new Map<string, { controller: AbortController; result: Promise<Blob> }>();
  get(key: string, load: (signal: AbortSignal) => Promise<Blob>): Promise<Blob> {
    const cached = this.completed.get(key);
    if (cached) return Promise.resolve(cached);
    const existing = this.pending.get(key);
    if (existing) return existing.result;
    const controller = new AbortController();
    const result = load(controller.signal).then((blob) => {
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (this.completed.size >= 12) this.completed.delete(this.completed.keys().next().value!);
      this.completed.set(key, blob);
      this.pending.delete(key);
      return blob;
    });
    this.pending.set(key, { controller, result });
    return result;
  }
  cancel() {
    for (const entry of this.pending.values()) entry.controller.abort();
    this.pending.clear();
  }
  clear() {
    this.cancel();
    this.completed.clear();
  }
}
