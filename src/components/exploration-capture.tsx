'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ExplorationCapture = {
  kind: 'upload' | 'capture';
  label: string;
  capturedAt: string;
  mimeType: 'image/jpeg';
  dataUrl: string;
  width: number;
  height: number;
};
const MAX_BYTES = 4 * 1024 * 1024;

function snapshot(
  image: CanvasImageSource,
  width: number,
  height: number,
  kind: ExplorationCapture['kind'],
  label: string,
): ExplorationCapture {
  if (!width || !height)
    throw new Error('The selected image is not ready. Try a sharper screenshot.');
  let scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('This browser could not prepare a screenshot. Try another browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  for (let attempt = 0; dataUrl.length > 680000 && attempt < 4; attempt++) {
    scale *= 0.78;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', 0.76);
  }
  if (dataUrl.length > 680000)
    throw new Error(
      'This screenshot is too large. Crop it to the relevant material and try again.',
    );
  return {
    kind,
    label: label.slice(0, 120),
    capturedAt: new Date().toISOString(),
    mimeType: 'image/jpeg',
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

export function useExplorationCapture() {
  const stream = useRef<MediaStream | null>(null),
    video = useRef<HTMLVideoElement | null>(null);
  const lifecycle = useRef(0),
    mounted = useRef(true);
  const [sharing, setSharing] = useState(false),
    [shareLabel, setShareLabel] = useState('');
  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
      video.current = null;
    }
  }, []);
  const stop = useCallback(() => {
    lifecycle.current++;
    release();
    if (mounted.current) setSharing(false);
  }, [release]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      lifecycle.current++;
      release();
    };
  }, [release]);
  const start = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia)
      throw new Error(
        'Window sharing is unavailable in this browser. Upload a screenshot instead.',
      );
    const attempt = ++lifecycle.current;
    const selected = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    if (!mounted.current || lifecycle.current !== attempt) {
      selected.getTracks().forEach((track) => track.stop());
      throw new Error('Window selection was cancelled.');
    }
    release();
    stream.current = selected;
    const element = document.createElement('video');
    element.muted = true;
    element.playsInline = true;
    element.srcObject = selected;
    try {
      await element.play();
    } catch {
      if (stream.current === selected) stop();
      selected.getTracks().forEach((track) => track.stop());
      element.srcObject = null;
      throw new Error('The shared window could not be opened. Try uploading a screenshot.');
    }
    if (!mounted.current || lifecycle.current !== attempt) {
      selected.getTracks().forEach((track) => track.stop());
      element.pause();
      element.srcObject = null;
      if (stream.current === selected) stream.current = null;
      throw new Error('Window selection was cancelled.');
    }
    video.current = element;
    setShareLabel(selected.getVideoTracks()[0]?.label || 'Selected window');
    setSharing(true);
    selected.getVideoTracks()[0]?.addEventListener(
      'ended',
      () => {
        if (stream.current === selected) stop();
      },
      { once: true },
    );
  };
  const capture = () => {
    const element = video.current;
    if (!element || !stream.current?.active)
      throw new Error('Sharing has ended. Share a window again or upload a screenshot.');
    return snapshot(
      element,
      element.videoWidth,
      element.videoHeight,
      'capture',
      shareLabel || 'Selected window',
    );
  };
  const upload = async (file: File): Promise<ExplorationCapture> => {
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > MAX_BYTES)
      throw new Error('Choose a PNG or JPEG screenshot under 4 MB.');
    const url = URL.createObjectURL(file),
      image = new Image();
    try {
      image.src = url;
      await image.decode();
      return snapshot(image, image.naturalWidth, image.naturalHeight, 'upload', file.name);
    } catch {
      throw new Error('This image could not be read. Choose a valid PNG or JPEG screenshot.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  return { sharing, shareLabel, start, stop, capture, upload };
}
