import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import https from "node:https";

const certDir = join(tmpdir(), "mindzjweb-https-test");
const certPath = join(certDir, "cert.pem");
const keyPath = join(certDir, "key.pem");
mkdirSync(certDir, { recursive: true });

if (!existsSync(certPath) || !existsSync(keyPath)) {
  const sans = new Set(["DNS:localhost", "IP:127.0.0.1", "IP:::1"]);
  const hostname = process.env.HOSTNAME;
  if (hostname) sans.add(`DNS:${hostname}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (!address.internal) {
        sans.add(`IP:${address.address}`);
      }
    }
  }

  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath, "-out", certPath, "-days", "14",
    "-subj", "/CN=WorkspaceWeb HTTPS test",
    "-addext", `subjectAltName=${[...sans].join(",")}`,
  ], { stdio: "ignore" });
}

const proxy = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, (request, response) => {
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: Number(process.env.MINDZJ_HTTP_PORT ?? 3000),
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: `127.0.0.1:${process.env.MINDZJ_HTTP_PORT ?? 3000}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", (error) => {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`MindZJ HTTP server is unavailable: ${error.message}`);
  });
  request.pipe(upstream);
});

const port = Number(process.env.MINDZJ_HTTPS_PORT ?? 3443);
proxy.listen(port, "0.0.0.0", () => {
  console.log(`WorkspaceWeb HTTPS test proxy listening on https://localhost:${port}`);
  console.log(`Self-signed test certificate: ${certPath}`);
  console.log("Import/trust this certificate in the browser to enable secure-context APIs.");
});
