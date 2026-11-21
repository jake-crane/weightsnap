import { ImageResponse } from "next/og";

export const ICON_BACKGROUND = "#2a78d6";

// Square, full-bleed app icon: a falling trend line on a blue tile. iOS and
// Android round the corners themselves, and the line stays inside the middle
// 60% so the icon still works when cropped as a maskable icon.
export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ICON_BACKGROUND,
        }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 100 100">
          <polyline
            points="8,24 34,48 54,40 86,76"
            fill="none"
            stroke="white"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="86" cy="76" r="9" fill="white" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
