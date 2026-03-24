import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = 512;

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
          background: "#DB5461",
          borderRadius: 100,
        }}
      >
        <div
          style={{
            width: "80%",
            height: "80%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "24px solid white",
            borderRadius: 60,
            padding: 30,
          }}
        >
          <div
            style={{
              fontSize: 240,
              fontWeight: 900,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            31
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
