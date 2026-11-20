// Single Node process for DragonBoundRE web and game in a Render 512MB lab.
// Original source stays unchanged; both original entrypoints are invoked as modules.
// Reduces duplicate V8 runtime overhead from two child Node processes.
process.on('warning', warning => {
  if (warning.name === 'MaxListenersExceededWarning') console.error('[lab] listener warning:', warning.message);
});
const NativeMap=globalThis.Map;
require('./src/game.js');
// Several legacy game modules assign an unscoped class named Map, replacing
// globalThis.Map; restore the ECMAScript native before loading log4js/rfdc.
globalThis.Map=NativeMap;
if(typeof globalThis.Map.prototype.set!=='function')throw Error('NATIVE_MAP_NOT_RESTORED');
require('./src/web/main/server.js');
