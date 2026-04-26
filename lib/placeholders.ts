function buildPlaceholderSvg(label: string, width: number, height: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="24" fill="#f2f0ec" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="#8a8a8a"
        font-family="Arial, sans-serif"
        font-size="${Math.max(18, Math.floor(width / 12))}"
        font-weight="700"
      >
        ${label}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const ARTIST_SQUARE_PLACEHOLDER = buildPlaceholderSvg("Intooni", 800, 800);
export const MAGAZINE_RECT_PLACEHOLDER = buildPlaceholderSvg("Magazine", 1200, 675);

