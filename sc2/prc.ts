import { Page } from "@playwright/test";

export async function countUniqueColorsFromBase64(
    page: Page,
    base64: string
): Promise<number> {
    
    const dataUrl = "data:image/png;base64," + base64;

    return await page.evaluate(async (imgSrc) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) return reject("No 2D context");

                    ctx.drawImage(img, 0, 0);

                    const { data } = ctx.getImageData(0, 0, img.width, img.height);

                    const colors = new Set<string>();

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const a = data[i + 3];

                        colors.add(`${r},${g},${b},${a}`);
                    }

                    resolve(colors.size);
                } catch (e) {
                    reject(e);
                }
            };

            img.onerror = reject;
            img.src = imgSrc;
        });
    }, dataUrl);
}
