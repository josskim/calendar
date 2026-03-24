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
          background: "#DB5461",
          borderRadius: 40,
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
            border: "8px solid white",
            borderRadius: 20,
            padding: 10,
          }}
        >
          <div
            style={{
              fontSize: 80,
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
