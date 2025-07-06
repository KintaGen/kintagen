// Vercel serverless proxy for Flow RPC endpointexport default async function handler(req, res) {
  const response = await fetch("https://testnet.evm.nodes.onflow.org", {
    method: req.method,
    headers: { ...req.headers, host: undefined },
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
  });
  const data = await response.arrayBuffer();
  res.status(response.status);
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }
  res.send(Buffer.from(data));
}
