/* scripts/dev-watch.mjs — stopgap for the ECONNRESET crash killing `astro dev`
   on Windows (ties to a Vite/Node dev-server socket bug, not app code — see
   chat). Not a fix, just keeps you unblocked: respawns `astro dev`
   automatically if the process dies, instead of you re-running it by hand.
   A manual Ctrl+C (SIGINT) does NOT trigger a restart. */
import { spawn } from 'node:child_process';

function run() {
  const child = spawn('npx', ['astro', 'dev'], { stdio: 'inherit', shell: true });
  child.on('exit', (code, signal) => {
    if (signal) { console.log(`\n[dev-watch] astro dev stopped (${signal}). Not restarting.`); return; }
    console.log(`\n[dev-watch] astro dev crashed (exit code ${code}). Restarting in 1s...`);
    setTimeout(run, 1000);
  });
}
run();
