interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Center {
  x: number;
  y: number;
}

interface Word {
  text: string;
  bbox: BBox;
}

interface WordWithCenter extends Word {
  center: Center;
}

interface Line {
  words: Word[];
}

interface LineWithCenters {
  words: WordWithCenter[];
}

interface TesseractResult {
  data: {
    blocks: {
      paragraphs: {
        lines: {
          words: {
            text: string;
            bbox: BBox;
          }[];
        }[];
      }[];
    }[];
  };
}

export class TesseractParser {
  // =====================================================
  // 1️⃣ — Все слова в один список (без центров)
  static extractWords(result: TesseractResult): Word[] {
    const words: Word[] = [];

    result.data.blocks.forEach(block =>
      block.paragraphs.forEach(paragraph =>
        paragraph.lines.forEach(line =>
          line.words.forEach(word => {
            if (word.text?.trim()) {
              words.push({ text: word.text.trim(), bbox: word.bbox });
            }
          })
        )
      )
    );

    return words;
  }

  // =====================================================
  // 2️⃣ — Слова по строкам (без центров)
  static extractWordsByLines(result: TesseractResult): Line[] {
    const lines: Line[] = [];

    result.data.blocks.forEach(block =>
      block.paragraphs.forEach(paragraph =>
        paragraph.lines.forEach(line => {
          const lineWords: Word[] = line.words
            .filter(w => w.text?.trim())
            .map(w => ({ text: w.text.trim(), bbox: w.bbox }));
          if (lineWords.length) lines.push({ words: lineWords });
        })
      )
    );

    return lines;
  }

  // =====================================================
  // 3️⃣ — Все слова в один список, включая центр
  static extractWordsWithCenter(result: TesseractResult): WordWithCenter[] {
    const words: WordWithCenter[] = [];

    result.data.blocks.forEach(block =>
      block.paragraphs.forEach(paragraph =>
        paragraph.lines.forEach(line =>
          line.words.forEach(word => {
            if (word.text?.trim()) {
              const bbox = word.bbox;
              const center = {
                x: (bbox.x0 + bbox.x1) / 2,
                y: (bbox.y0 + bbox.y1) / 2
              };
              words.push({
                text: word.text.trim(),
                bbox,
                center
              });
            }
          })
        )
      )
    );

    return words;
  }

  // =====================================================
  // 4️⃣ — Слова по строкам, включая центры
  static extractWordsByLinesWithCenter(result: TesseractResult): LineWithCenters[] {
    const lines: LineWithCenters[] = [];

    result.data.blocks.forEach(block =>
      block.paragraphs.forEach(paragraph =>
        paragraph.lines.forEach(line => {
          const lineWords: WordWithCenter[] = line.words
            .filter(w => w.text?.trim())
            .map(w => {
              const bbox = w.bbox;
              const center = {
                x: (bbox.x0 + bbox.x1) / 2,
                y: (bbox.y0 + bbox.y1) / 2
              };
              return { text: w.text.trim(), bbox, center };
            });

          if (lineWords.length) lines.push({ words: lineWords });
        })
      )
    );

    return lines;
  }
}
