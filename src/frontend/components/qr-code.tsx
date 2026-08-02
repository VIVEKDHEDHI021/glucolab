import React from "react";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

// Simple matrix calculation for QR code presentation / rendering
export const QRCodeSVG: React.FC<QRCodeProps> = ({ value, size = 180, className = "" }) => {
  // Generate deterministic grid pattern based on string hash for rendering crisp QR visuals
  const gridSize = 21;
  const hashString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  };

  const seed = Math.abs(hashString(value));
  const matrix: boolean[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(false)
  );

  // Helper to draw Finder Patterns (corners)
  const drawFinderPattern = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startRow + r][startCol + c] = true;
        }
      }
    }
  };

  // 1. Finder patterns at top-left, top-right, bottom-left
  drawFinderPattern(0, 0);
  drawFinderPattern(0, gridSize - 7);
  drawFinderPattern(gridSize - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < gridSize - 8; i += 2) {
    matrix[6][i] = true;
    matrix[i][6] = true;
  }

  // 3. Data bits based on value hash
  let currentSeed = seed;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Skip finder pattern zones
      const isTopLeft = r < 8 && c < 8;
      const isTopRight = r < 8 && c >= gridSize - 8;
      const isBottomLeft = r >= gridSize - 8 && c < 8;

      if (!isTopLeft && !isTopRight && !isBottomLeft) {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        matrix[r][c] = currentSeed / 233280 > 0.45;
      }
    }
  }

  const cellSize = size / gridSize;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border border-border ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-auto"
      >
        <rect width={size} height={size} fill="#FFFFFF" />
        {matrix.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize + 0.3}
                height={cellSize + 0.3}
                fill="#0F172A"
              />
            );
          })
        )}
      </svg>
      <div className="mt-2 text-center">
        <span className="font-mono text-xs font-bold tracking-wider text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
          {value}
        </span>
      </div>
    </div>
  );
};
