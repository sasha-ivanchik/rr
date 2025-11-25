class ImageUtils {
    /**
     * Receives a base64 image string (data:image/png;base64,....)
     * and returns the number of unique colors in the image.
     */
    static async countUniqueColors(base64: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) return reject("Unable to get canvas context");

                    ctx.drawImage(img, 0, 0);

                    // Extract all pixels
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const data = imageData.data; // Uint8ClampedArray [r,g,b,a,r,g,b,a...]

                    const colors = new Set<string>();

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const a = data[i + 3];

                        // Build a compact 32-bit color key
                        const key = `${r},${g},${b},${a}`;
                        colors.add(key);
                    }

                    resolve(colors.size);
                } catch (e) {
                    reject(e);
                }
            };

            img.onerror = (err) => reject(err);

            img.src = base64;
        });
    }
}
