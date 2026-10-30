import sharp from 'sharp';
import { imageRegionSchema, type ImageRegion } from '../domain/source-grounding';
import { parseScreenshotDataUrl } from './image-source';
/** Crop only the frozen, size-validated inline screenshot. No filesystem/URL input. */
export async function cropSourceDetail(dataUrl: string, region: ImageRegion) {
  const image = parseScreenshotDataUrl(dataUrl),
    r = imageRegionSchema.parse(region);
  const left = Math.floor(r.x * image.width),
    top = Math.floor(r.y * image.height);
  const width = Math.min(image.width - left, Math.max(1, Math.ceil(r.width * image.width)));
  const height = Math.min(image.height - top, Math.max(1, Math.ceil(r.height * image.height)));
  if (width < 8 || height < 8 || r.width * r.height > 0.8)
    throw Error('Choose a bounded, readable detail region.');
  const bytes = await sharp(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    limitInputPixels: 1600 * 1600,
    failOn: 'error',
  })
    .extract({ left, top, width, height })
    .resize({
      width: Math.min(1600, width * 2),
      height: Math.min(1600, height * 2),
      fit: 'inside',
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  if (bytes.length > 512 * 1024) throw Error('Detail exceeds image limit.');
  const cropped = 'data:image/jpeg;base64,' + bytes.toString('base64');
  parseScreenshotDataUrl(cropped);
  return {
    dataUrl: cropped,
    region: {
      x: left / image.width,
      y: top / image.height,
      width: width / image.width,
      height: height / image.height,
    },
  };
}
