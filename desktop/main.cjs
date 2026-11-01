const { app, BrowserWindow, clipboard, dialog } = require("electron");
const { randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

let apiProcess;
let mainWindow;
let quitting = false;
let apiPort;
let apiStderr = "";
let bootstrapKey;
let setupWatchTimer;

function writeStartupLog(message) {
  try {
    const directory = path.join(app.getPath("userData"), "data");
    fs.mkdirSync(directory, { recursive: true });
    fs.appendFileSync(path.join(directory, "startup.log"), `${new Date().toISOString()} ${message}\n`);
  } catch { /* Diagnostics must not block app startup. */ }
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function getBootstrapKey() {
  const dataDirectory = path.join(app.getPath("userData"), "data");
  const keyPath = path.join(dataDirectory, "first-owner-setup.key");
  fs.mkdirSync(dataDirectory, { recursive: true });
  try {
    const existing = fs.readFileSync(keyPath, "utf8").trim();
    if (existing.length >= 64) return existing;
  } catch { /* Create a new key for this installation. */ }
  const generated = randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(keyPath, `${generated}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return generated;
  } catch (error) {
    if (error.code === "EEXIST") return fs.readFileSync(keyPath, "utf8").trim();
    throw error;
  }
}

function startApi(port) {
  const dataDirectory = path.join(app.getPath("userData"), "data");
  const environment = {
    ...process.env,
    OriginalRoot_HOST: "127.0.0.1",
    OriginalRoot_PORT: String(port),
    PYTHONUNBUFFERED: "1",
    OriginalRoot_OPERATOR_TOKEN: bootstrapKey,
    OriginalRoot_DB_PATH: path.join(dataDirectory, "OriginalRoot.sqlite3"),
    OriginalRoot_ROOT: app.isPackaged
      ? path.join(process.resourcesPath, "app-assets")
      : path.resolve(__dirname, ".."),
  };

  if (app.isPackaged) {
    const apiExecutable = path.join(process.resourcesPath, "OriginalRoot-api.exe");
    writeStartupLog(`Starting bundled service on 127.0.0.1:${port}; executable exists=${fs.existsSync(apiExecutable)}; assets exist=${fs.existsSync(environment.OriginalRoot_ROOT)}`);
    apiProcess = spawn(apiExecutable, [], {
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } else {
    apiProcess = spawn(process.env.PYTHON || "python", ["api/server.py"], {
      cwd: path.resolve(__dirname, ".."),
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  apiProcess.stderr?.on("data", (chunk) => {
    apiStderr = (apiStderr + chunk.toString()).slice(-3000);
    writeStartupLog(`Service stderr: ${chunk.toString().trim()}`);
  });
  apiProcess.stdout?.on("data", (chunk) => writeStartupLog(`Service stdout: ${chunk.toString().trim()}`));
  apiProcess.once("spawn", () => writeStartupLog(`Service process started; pid=${apiProcess.pid}`));
  apiProcess.once("error", (error) => {
    writeStartupLog(`Service process error: ${error.message}`);
    dialog.showErrorBox("OriginalRoot could not start", `The local OriginalRoot service failed to start.\n\n${error.message}`);
    app.quit();
  });
  apiProcess.once("exit", (code) => {
    writeStartupLog(`Service process exited with code ${code}`);
    if (!quitting && code !== 0) {
      dialog.showErrorBox("OriginalRoot stopped", "The local OriginalRoot service stopped unexpectedly. Reopen OriginalRoot to try again.");
      app.quit();
    }
  });
}

async function waitForApi(port) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (!apiProcess || apiProcess.exitCode !== null) throw new Error(`The OriginalRoot service exited before it became ready.${apiStderr ? `\n\n${apiStderr}` : ""}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch { /* The service is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`The OriginalRoot service did not become ready within 30 seconds.${apiStderr ? `\n\n${apiStderr}` : ""}`);
}

async function createWindow() {
  bootstrapKey = getBootstrapKey();
  apiPort = await availablePort();
  startApi(apiPort);
  await waitForApi(apiPort);
  const setupResponse = await fetch(`http://127.0.0.1:${apiPort}/api/operator/setup-status`);
  const setupStatus = setupResponse.ok ? await setupResponse.json() : { setup_required: false };
  if (!setupStatus.setup_required) {
    const keyPath = path.join(app.getPath("userData"), "data", "first-owner-setup.key");
    fs.rmSync(keyPath, { force: true });
  } else {
    setupWatchTimer = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/api/operator/setup-status`);
        const status = response.ok ? await response.json() : null;
        if (status && !status.setup_required) {
          fs.rmSync(path.join(app.getPath("userData"), "data", "first-owner-setup.key"), { force: true });
          clearInterval(setupWatchTimer);
          setupWatchTimer = undefined;
          writeStartupLog("First owner created; removed saved setup key.");
        }
      } catch { /* Leave the key available while the local setup is incomplete. */ }
    }, 2500);
  }
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    title: "OriginalRoot",
    backgroundColor: "#f7f8f4",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${apiPort}/`)) return { action: "allow" };
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${apiPort}/`)) event.preventDefault();
  });
  await mainWindow.loadURL(`http://127.0.0.1:${apiPort}/`);
  if (setupStatus.setup_required) {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Set up OriginalRoot owner access",
      message: "Copy this one-time setup key, then open Operations to create the first owner account.",
      detail: bootstrapKey,
      buttons: ["Copy setup key", "Later"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (choice.response === 0) {
      clipboard.writeText(bootstrapKey);
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Setup key copied",
        message: "The key is on your clipboard. Paste it into the first-owner setup form in Operations.",
        buttons: ["OK"],
      });
    }
  }
}

app.whenReady().then(createWindow).catch((error) => {
  writeStartupLog(`Startup failed: ${error.stack || error.message}`);
  dialog.showErrorBox("OriginalRoot could not start", error.message);
  app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  if (setupWatchTimer) clearInterval(setupWatchTimer);
  if (apiProcess && apiProcess.exitCode === null) apiProcess.kill();
});

app.on("window-all-closed", () => app.quit());
