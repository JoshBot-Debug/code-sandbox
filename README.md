# C++ Executor

A minimal, hardened Node.js service that compiles and runs C++ code on demand.

## Build & Run

```bash
docker compose up --build
```

OR

```bash
docker compose down && docker compose up --build
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

## Security Model

Don't trust this repo