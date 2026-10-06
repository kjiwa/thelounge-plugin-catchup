"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");
const { io } = require("socket.io-client");

const fixture = require("./fixture.js");

const ROOT = path.resolve(__dirname, "..", "..");
const LOUNGE = path.join(ROOT, "node_modules", "thelounge", "index.js");
const PASSWORD = "fixture-password";
const PACKAGE = "thelounge-plugin-catchup";

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function startBedrockStub() {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => res.writeHead(404).end());
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "catchup-e2e-"));
  const env = { ...process.env, THELOUNGE_HOME: home };
  fs.mkdirSync(path.join(home, "users"));
  execFileSync(
    process.execPath,
    [LOUNGE, "add", fixture.USER, "--password", PASSWORD, "--save-logs"],
    { env },
  );
  fixture.writeUser(home);
  fixture.writeLog(home);
  return { home, env };
}

function installTarball(home, env) {
  const tarballs = path.join(home, "tarballs");
  fs.mkdirSync(tarballs);
  execFileSync("npm", ["pack", "--pack-destination", tarballs], {
    cwd: ROOT,
    env,
    stdio: "ignore",
  });
  const tarball = path.join(tarballs, fs.readdirSync(tarballs)[0]);
  const packages = path.join(home, "packages");
  fs.mkdirSync(packages, { recursive: true });
  execFileSync(
    "npm",
    ["install", "--prefix", packages, "--no-audit", "--no-fund", tarball],
    { env, stdio: "ignore" },
  );
}

async function waitForInit(port) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      return await login(port);
    } catch {
      await sleep(250);
    }
  }
  throw new Error("The Lounge did not accept a login within 30s");
}

function login(port) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, { reconnection: false });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("login timed out"));
    }, 5000);
    const settle = (fn, value) => {
      clearTimeout(timer);
      fn(value);
    };
    socket.on("connect_error", (err) => {
      socket.close();
      settle(reject, err);
    });
    socket.on("auth:start", () =>
      socket.emit("auth:perform", { user: fixture.USER, password: PASSWORD }),
    );
    socket.on("auth:failed", () => {
      socket.close();
      settle(reject, new Error("auth:failed"));
    });
    socket.on("init", (data) => settle(resolve, { socket, init: data }));
  });
}

test("The Lounge loads the packed plugin and the fixture log is readable", async (t) => {
  const stub = await startBedrockStub();
  const { home, env } = createHome();
  let server;
  let session;
  t.after(async () => {
    session?.socket.close();
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      server.kill("SIGTERM");
      await exited;
    }
    stub.close();
    fs.rmSync(home, { recursive: true, force: true });
  });

  installTarball(home, env);
  const port = await freePort();
  fixture.writeConfig(home, port);

  let output = "";
  server = spawn(process.execPath, [LOUNGE, "start"], {
    env: {
      ...env,
      NO_COLOR: "1",
      AWS_ENDPOINT_URL_BEDROCK_RUNTIME: `http://127.0.0.1:${stub.address().port}`,
      AWS_ACCESS_KEY_ID: "fake",
      AWS_SECRET_ACCESS_KEY: "fake",
      AWS_REGION: "us-west-2",
    },
  });
  server.stdout.on("data", (chunk) => (output += chunk));
  server.stderr.on("data", (chunk) => (output += chunk));

  session = await waitForInit(port);

  assert.match(output, new RegExp(`Package ${PACKAGE} v[\\d.]+ loaded`));
  assert.doesNotMatch(output, /could not be loaded/);
  assert.equal(session.init.networks.length, 1);

  const db = new DatabaseSync(
    path.join(home, "logs", `${fixture.USER}.sqlite3`),
    { readOnly: true },
  );
  const rows = db
    .prepare("SELECT msg FROM messages WHERE channel = ? ORDER BY time")
    .all(fixture.CHANNEL);
  db.close();
  assert.deepEqual(
    rows.map((row) => JSON.parse(row.msg).text),
    fixture.MESSAGES.map(([, text]) => text),
  );
});
