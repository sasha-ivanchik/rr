interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Word {
  text: string;
  bbox: BBox;
}

interface Line {
  words: Word[];
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
  // 1️⃣ — Все слова в один список
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

  // 2️⃣ — Слова, сгруппированные по строкам
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
}
