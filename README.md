# C++ Executor

A minimal, hardened Node.js service that compiles and runs C++ code on demand.

## Build & Run

```bash
docker compose up --build
```

The service listens on **port 2000** and exposes a single endpoint: `POST /execute`.

---

## Usage

Send C++ source code in the request body — either as raw text or as JSON.

### Option A — Raw body (plain text)

```bash
curl -X POST http://localhost:2000/execute \
  -H "Content-Type: text/plain" \
  --data '#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}'
```

### Option B — JSON body

```bash
curl -X POST http://localhost:2000/execute \
  -H "Content-Type: application/json" \
  -d '{"code": "#include <iostream>\nint main() { std::cout << 42; }"}'
```

---

## Response

```json
{
  "success": true,
  "stage": "run",
  "exit_code": 0,
  "timed_out": false,
  "stdout": "Hello, World!\n",
  "stderr": "",
  "compile_time_ms": 312,
  "run_time_ms": 4
}
```

On compile failure:

```json
{
  "success": false,
  "stage": "compile",
  "error": "Compilation failed",
  "output": "main.cpp:3:5: error: ...",
  "compile_time_ms": 280
}
```

---

## Security Model

| Control | Detail |
|---|---|
| **No root** | Server runs as `executor` user (non-root) |
| **No internet** | `network_mode: none` — zero network access |
| **No capabilities** | `cap_drop: ALL` — no Linux capabilities |
| **No privilege escalation** | `no-new-privileges:true` |
| **Read-only filesystem** | Only `/tmp` (tmpfs, 32 MB RAM disk) is writable |
| **Resource caps** | 128 MB RAM, 0.5 CPU, no swap |
| **Execution limits** | `ulimit`: 128 MB virtual memory, 8 CPU-seconds, 512 KB file output |
| **Compile timeout** | 15 seconds |
| **Run timeout** | 10 seconds |
| **Output cap** | 64 KB stdout/stderr each |
| **Source size cap** | 64 KB max request body |
| **Temp cleanup** | Each request gets a unique temp dir, deleted immediately after |

---

## Limits at a Glance

| Limit | Value |
|---|---|
| Max source size | 64 KB |
| Compile timeout | 15 s |
| Run timeout | 10 s |
| Max RAM (container) | 128 MB |
| Max RAM (per execution, ulimit) | 128 MB virtual |
| CPU (container) | 0.5 cores |
| CPU time (ulimit) | 8 s |
| Max output | 64 KB stdout + 64 KB stderr |
| Filesystem writes | /tmp only, 32 MB total |