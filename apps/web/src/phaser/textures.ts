/** Rasterises code-generated SVG art into images that Phaser can use as textures. */
export function svgToImage(svg: string, width: number, height: number): Promise<HTMLImageElement> {
  const sized = svg.replace(/<svg ([^>]*?)width="\d+" height="\d+"/, `<svg $1width="${width}" height="${height}"`);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG rasterisation failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  });
}

export function radialCanvas(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function prefersReducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced';
}
