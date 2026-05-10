const childProcess = require('child_process');
const { PassThrough } = require('stream');
const { EventEmitter } = require('events');
const { syncBuiltinESMExports } = require('module');

const originalExec = childProcess.exec;

function createNoopChildProcess() {
  const processLike = new EventEmitter();
  processLike.stdin = new PassThrough();
  processLike.stdout = new PassThrough();
  processLike.stderr = new PassThrough();
  processLike.kill = () => true;
  processLike.pid = 0;
  processLike.killed = false;
  processLike.exitCode = 0;
  return processLike;
}

childProcess.exec = function patchedExec(command, options, callback) {
  const cb = typeof options === 'function' ? options : callback;

  if (process.platform === 'win32' && String(command).trim().toLowerCase() === 'net use') {
    const child = createNoopChildProcess();
    setImmediate(() => {
      cb?.(null, 'New connections will be remembered.\r\n\r\nThere are no entries in the list.\r\n', '');
      child.emit('exit', 0, null);
      child.emit('close', 0, null);
    });
    return child;
  }

  return originalExec.apply(this, arguments);
};

syncBuiltinESMExports();
