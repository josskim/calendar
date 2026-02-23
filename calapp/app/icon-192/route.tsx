import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = 192;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#66707f",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: 172,
            height: 172,
            borderRadius: 20,
            background: "#ffffff",
            border: "4px solid #2d3440",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#123E6B",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 56, lineHeight: 1 }}>🏠✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>
            Smart Check-in
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>
            StayNamchen
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
