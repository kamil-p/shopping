import { ImageResponse } from "next/og";

// One handler renders every icon variant: green brand background (matching the
// .zk-brand-mark gradient) with a centered white shopping-cart glyph. The cart
// is embedded as a base64 SVG <img> — Satori renders that reliably and we need
// no text (so no font is required). All these URLs contain a dot, so the proxy
// matcher serves them publicly without a session.

type Spec = { size: number; maskable: boolean };

const SPECS: Record<string, Spec> = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "icon-512-maskable.png": { size: 512, maskable: true },
  "apple-icon.png": { size: 180, maskable: false },
};

function cartDataUri(px: number): string {
  // lucide "shopping-cart", white stroke.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.7" ` +
    `stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="8" cy="21" r="1"/>` +
    `<circle cx="19" cy="21" r="1"/>` +
    `<path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const spec = SPECS[name];
  if (!spec) {
    return new Response("Not found", { status: 404 });
  }

  const { size, maskable } = spec;
  // Maskable icons must keep content inside the ~80% safe circle, so the glyph
  // is smaller; "any"/apple icons can use more of the canvas.
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(150deg, #1f8a52, #19713f)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={glyph} height={glyph} src={cartDataUri(glyph)} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
