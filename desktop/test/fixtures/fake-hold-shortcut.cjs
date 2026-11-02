#!/usr/bin/env node
// Stands in for the native Control–Option–Space helper in live end-to-end tests (development
// runs only): SIGUSR1 reports the shortcut pressed, SIGUSR2 released.
const send = (event) => process.stdout.write(JSON.stringify(event) + '\n');
send({ type: 'ready', available: true });
process.on('SIGUSR1', () => send({ type: 'pressed' }));
process.on('SIGUSR2', () => send({ type: 'released' }));
process.stdin.resume?.();
setInterval(() => {}, 1 << 30);
