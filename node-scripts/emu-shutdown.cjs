// Wrapper that makes Firestore Emulator persist even when VS Code Stop is used.
const { spawn } = require("child_process");

const DATA_DIR = process.env.FIRESTORE_EMU_DATA || "./emulator-data";
const FIREBASE_CMD = process.platform === "win32" ? "firebase.cmd" : "firebase";

const args = [
  "emulators:start",
  "--only", "auth,firestore",
  "--import", DATA_DIR,
  "--export-on-exit"
];

const emu = spawn(FIREBASE_CMD, args, { stdio: "inherit", shell: true });

// Graceful shutdown translator + fallback export
function shutdown(reason) {
  console.log(`\n[emulator] Received ${reason}. Attempting graceful shutdown…`);

  // Ask emulator to exit cleanly (this is what triggers --export-on-exit)
  try { emu.kill("SIGINT"); } catch (_) {}

  // If it doesn’t die in time, force an export then kill.
  const timeoutMs = 12000;
  const t = setTimeout(() => {
    console.warn("[emulator] Graceful shutdown timed out. Running fallback export…");
    const exp = spawn(FIREBASE_CMD, ["emulators:export", DATA_DIR], { stdio: "inherit", shell: true });
    exp.on("close", () => {
      try { emu.kill("SIGKILL"); } catch (_) {}
      process.exit(0);
    });
  }, timeoutMs);

  emu.on("exit", (code, sig) => {
    clearTimeout(t);
    process.exit(code ?? 0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM")); // VS Code Stop usually sends this
process.on("SIGHUP",  () => shutdown("SIGHUP"));  // Terminal closed
process.on("SIGINT",  () => shutdown("SIGINT"));  // Ctrl+C passthrough
emu.on("exit", (code) => process.exit(code ?? 0));
