function sharpen(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const weights = [
     0, -1,  0,
    -1,  5, -1,
     0, -1,  0
  ];
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  const w = width * 4;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 4; x < w - 4; x += 4) {
      for (let c = 0; c < 3; c++) {
        const idx = y * w + x + c;
        const val =
          weights[0]*copy[idx - w]   + weights[1]*copy[idx - w + 4]   + weights[2]*copy[idx - w + 8] +
          weights[3]*copy[idx - 4]   + weights[4]*copy[idx]           + weights[5]*copy[idx + 4] +
          weights[6]*copy[idx + w-4] + weights[7]*copy[idx + w]       + weights[8]*copy[idx + w + 4];
        data[idx] = Math.min(255, Math.max(0, val));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
