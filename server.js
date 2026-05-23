const http = require("http");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const PORT = 2000;
const MAX_BODY_SIZE = 64 * 1024;
const EXECUTION_TIMEOUT_MS = 10_000;
const COMPILE_TIMEOUT_MS = 15_000;

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      data += chunk;
    });

    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function runCommand(cmd, options = {}) {
  return new Promise((resolve) => {
    const child = exec(
      cmd,
      {
        timeout: options.timeout || EXECUTION_TIMEOUT_MS,
        maxBuffer: 1024 * 256,
        ...options,
      },
      (error, stdout, stderr) => {
        resolve({ error, stdout, stderr, code: error?.code ?? 0 });
      }
    );
  });
}

async function handleExecute(req, res) {
  if (req.method !== "POST") {
    return sendJSON(res, 405, { error: "Method not allowed. Use POST." });
  }

  let rawBody;
  try {
    rawBody = await readBody(req);
  } catch (e) {
    return sendJSON(res, 413, { error: e.message });
  }

  let code;
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody);
      code = parsed.code;
    } catch {
      return sendJSON(res, 400, { error: "Invalid JSON body" });
    }
  } else {
    code = rawBody;
  }

  if (!code || typeof code !== "string" || !code.trim()) {
    return sendJSON(res, 400, { error: "No C++ code provided" });
  }

  const id = crypto.randomBytes(8).toString("hex");
  const tmpDir = path.join(os.tmpdir(), `cpp_exec_${id}`);
  const srcFile = path.join(tmpDir, "main.cpp");
  const binFile = path.join(tmpDir, "main");

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(srcFile, code, "utf8");

    // Compile
    const compileStart = Date.now();
    const compile = await runCommand(
      `g++ -O2 -std=c++23 -Wall -Wextra -o "${binFile}" "${srcFile}" 2>&1`,
      { timeout: COMPILE_TIMEOUT_MS }
    );
    const compileMs = Date.now() - compileStart;

    if (compile.error || !fs.existsSync(binFile)) {
      const compileOutput = (compile.stdout + compile.stderr).trim();
      return sendJSON(res, 422, compileOutput);
    }

    const execStart = Date.now();
    const run = await runCommand(
      `bash -c "ulimit -v 131072 -t 8 -f 512; \\"${binFile}\\""`,
      { timeout: EXECUTION_TIMEOUT_MS }
    );
    const execMs = Date.now() - execStart;

    const stdout = run.stdout;
    const stderr = run.stderr;
    const exitCode = run.error?.code ?? 0;
    const timedOut =
      run.error?.killed || run.error?.signal === "SIGTERM" || execMs >= EXECUTION_TIMEOUT_MS - 100;

    return sendJSON(res, 200, stdout.slice(0, 65536));
  } catch (e) {
    return sendJSON(res, 500, { error: "Internal server error", detail: e.message });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/execute") {
    return handleExecute(req, res);
  }

  return sendJSON(res, 404, { error: "Not found. Use POST /execute" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`C++ executor listening on port ${PORT}`);
});

server.on("error", (e) => {
  console.error("Server error:", e);
  process.exit(1);
});