/** Flat text panels drawn to a canvas texture: cost labels and the caption board. Redrawn only when text changes. */
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

export type TextPanel = { mesh: Mesh; set(lines: string[]): void };

export function textPanel(widthM: number, heightM: number, options: { px?: number; background?: string; colour?: string; font?: number; align?: CanvasTextAlign } = {}): TextPanel {
  const px = options.px ?? 1024;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.round((px * heightM) / widthM);
  const context = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(new PlaneGeometry(widthM, heightM), new MeshBasicMaterial({ map: texture, transparent: true }));
  let last = '';
  function set(lines: string[]) {
    const key = lines.join('\n');
    if (key === last) return;
    last = key;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (options.background) {
      context.fillStyle = options.background;
      context.beginPath();
      context.roundRect(0, 0, canvas.width, canvas.height, canvas.height * 0.12);
      context.fill();
    }
    const size = options.font ?? Math.round(canvas.height * 0.22);
    context.fillStyle = options.colour ?? '#f2efe8';
    context.textAlign = options.align ?? 'center';
    context.textBaseline = 'middle';
    const x = context.textAlign === 'left' ? canvas.width * 0.05 : canvas.width / 2;
    lines.forEach((line, i) => {
      context.font = `${i === 0 ? 600 : 400} ${i === 0 ? size : Math.round(size * 0.72)}px system-ui, sans-serif`;
      const y = (canvas.height * (i + 0.5)) / Math.max(1, lines.length);
      context.fillText(line, x, y, canvas.width * 0.92);
    });
    texture.needsUpdate = true;
  }
  return { mesh, set };
}
