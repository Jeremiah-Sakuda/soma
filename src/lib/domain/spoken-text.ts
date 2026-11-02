// Rewrites narration for a voice: the notation a slide or caption uses reads well but is
// spoken badly ("F ≤ 11 → 7", "the A–F edge", "dist[v]"). Pure and conservative: it only
// touches notation and small whole numbers, never the wording itself.
const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function numberWords(n: number): string {
  if (n < 20) return UNITS[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + UNITS[n % 10] : '');
}
export function spokenText(text: string): string {
  return (
    text
      // dist[v] → dist of v
      .replace(/\b([A-Za-z]\w*)\[(\w+)\]/g, '$1 of $2')
      // A single letter compared with something: "F ≤ 11" → "F is at most 11".
      .replace(/\b([A-Z])\s*≤\s*/g, '$1 is at most ')
      .replace(/\b([A-Z])\s*≥\s*/g, '$1 is at least ')
      .replace(/\s*≤\s*/g, ' at most ')
      .replace(/\s*≥\s*/g, ' at least ')
      // A connection or route between single letters: "A–F", "A-F", "A → C → F".
      .replace(/\b([A-Z])\s*[–—-]\s*(?=[A-Z]\b)/g, '$1 to ')
      .replace(/\b([A-Z])\s*→\s*(?=[A-Z]\b)/g, '$1 to ')
      // A value that changes: "11 → 7" → "11, now 7".
      .replace(/\s*→\s*/g, ', now ')
      .replace(/\s+=\s+/g, ' is ')
      .replace(/\s+\+\s+/g, ' plus ')
      .replace(/\s+<\s+/g, ' is less than ')
      .replace(/\s+>\s+/g, ' is more than ')
      .replace(/∞/g, 'infinity')
      // Whole numbers under 100 as words: a voice can stumble on bare digits.
      .replace(/(?<![\w.,])(\d{1,2})(?![\w.,]\d|\w)/g, (_m, d: string) => numberWords(Number(d)))
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}
