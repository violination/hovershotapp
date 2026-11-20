// Single Node process for DragonBoundRE web and game in a Render 512MB lab.
// Original source stays unchanged; both original entrypoints are invoked as modules.
// Reduces duplicate V8 runtime overhead from two child Node processes.
process.on('warning', warning => {
  if (warning.name === 'MaxListenersExceededWarning') console.error('[lab] listener warning:', warning.message);
});
require('./src/game.js');
require('./src/web/main/server.js');
