import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get("cid");
    if (!cid) {
      return NextResponse.json({ error: "Missing CID parameter" }, { status: 400 });
    }

    const cleanCid = cid.replace("ipfs://", "").trim();
    const customGateway = searchParams.get("gateway");
    const gateways = [];

    if (customGateway) {
      const cleanCustom = customGateway.trim();
      const base = cleanCustom.endsWith("/") ? cleanCustom : `${cleanCustom}/`;
      gateways.push(`${base}${cleanCid}`);
    }

    gateways.push(
      `https://ipfs.io/ipfs/${cleanCid}`,
      `https://cloudflare-ipfs.com/ipfs/${cleanCid}`,
      `https://gateway.pinata.cloud/ipfs/${cleanCid}`,
      `https://dweb.link/ipfs/${cleanCid}`,
      `https://w3s.link/ipfs/${cleanCid}`
    );

    let lastError = null;
    for (const url of gateways) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const response = await fetch(url, { 
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        clearTimeout(id);

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data);
          } else {
            const text = await response.text();
            try {
              return NextResponse.json(JSON.parse(text));
            } catch {
              return NextResponse.json({ raw: text });
            }
          }
        }
      } catch (e: any) {
        lastError = e;
      }
    }

    return NextResponse.json(
      { error: `All gateways failed. Last error: ${lastError?.message || "Timeout"}` },
      { status: 502 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
