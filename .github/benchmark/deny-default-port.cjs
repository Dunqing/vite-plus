const { Server } = require('node:net');
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  const options = args[0];
  const port = typeof options === 'object' ? options?.port : options;
  if (Number(port) === 63315) {
    console.error('SIMULATED_DEFAULT_PORT_EACCES');
    const error = Object.assign(new Error('SIMULATED_DEFAULT_PORT_EACCES: listen ::1:63315'), {
      code: 'EACCES',
      errno: -4092,
      syscall: 'listen',
      address: '::1',
      port: 63315,
    });
    process.nextTick(() => this.emit('error', error));
    return this;
  }
  if (Number(port) === 0) {
    this.once('listening', () => console.error('OS_SELECTED_PORT', this.address()));
  }
  return Reflect.apply(listen, this, args);
};
