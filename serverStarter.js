const fs = require('fs');
const net = require('net');

function serverStarter(server, config, callback) {
  if (typeof server.listen != 'function') {
    throw new TypeError(
      'server argument must have a member function called `listen`'
    );
  }

  if (!callback)
    callback = function(err, data) {
      if (err) {
        throw { err, data };
      }
    };

  function StartListening() {
    server.listen(config.listen, config.hostname);
  }

  function handleListening() {
    server.removeListener('error', handleError);
    var addr = server.address();
    function done() {
      callback(null, addr);
    }
    if (addr.port && addr.port > 0) {
      // Listening on a port. We're done here.
      done();
      return;
    }

    // An extra handler for the done function since we redefine it later. This may be unnecessary.
    var done2 = done;

    // Listening on a socket
    if (config.socketOwner) {
      // Load current process uid/gid in case we're only setting one of them
      var user = process.getuid();
      var group = process.getgid();
      // Make sure user and group are set to something reasonable
      var set = false;
      var req;
      if (isPosInt(config.socketOwner.user)) {
        user = config.socketOwner.user;
        set = true;
      } else if (
        typeof config.socketOwner.user === 'string' &&
        (req = requireUserId())
      ) {
        user = req.uid(config.socketOwner.user);
        set = true;
      }
      if (isPosInt(config.socketOwner.group)) {
        group = config.socketOwner.group;
        set = true;
      } else if (
        typeof config.socketOwner.group === 'string' &&
        (req = requireUserId())
      ) {
        group = req.gid(config.socketOwner.group);
        set = true;
      }
      // Only if we actually set a user or group properly does this do anything
      if (set) {
        // Redefine done2, to be called shortly.
        done2 = function() {
          fs.chown(addr, user, group, done);
        };
      }
    }
    if (config.socketMode) {
      fs.chmod(addr, config.socketMode, done2);
    } else {
      done2();
    }
  }

  function handleError(err) {
    // If there is an error, it is very likely that it is because our old socket
    // is still around. Check if it is still alive and if not, remove it and start
    // again.
    function done(e, extra) {
      server.removeListener('listening', handleListening);
      callback(e, err, extra);
    }
    if (err.code == 'EADDRINUSE') {
      if (err.port > 0) {
        done(`Address (${err.address} ${err.port}) already in use`);
      } else if (err.address) {
        // Try to connect. If not running, remove and continue.
        var clientSocket = new net.Socket();

        clientSocket.on('error', function(e) {
          if (e.code == 'ECONNREFUSED') {
            // Remove and continue
            fs.unlink(err.address, StartListening);
          } else {
            done('Unknown error', e);
          }
        });

        // Try to connect
        clientSocket.connect(
          { path: err.address },
          function() {
            done(`Address (${err.address}) already in use`);
            clientSocket.unref();
          }
        );
      } else {
        // Unknown address in use error
        done('Address in use');
      }
    } else {
      // Other error
      done('Other error');
    }
  }

  server.once('listening', handleListening);
  server.once('error', handleError);

  StartListening();
}

function isPosInt(i) {
  return typeof i === 'number' && i % 1 === 0 && i >= 0;
}

var userid;

function requireUserId() {
  return (userid = userid || require('userid'));
}

module.exports = serverStarter;
