const fs = require('fs');

function serverStarter (server, config, callback) {

  if (!callback) callback = function(err, data) {
    if (err) {
      throw {err, data};
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
    if (addr.port && (addr.port > 0)) {
      // listening on a port
    } else {
      // listening on a socket
      if (config.socketMode) {
        fs.chmod(addr, config.socketMode, done);
        return;
      }
    }
    done();
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

        clientSocket.on('error', function (e) {
          if (e.code == 'ECONNREFUSED') {
            // Remove and continue
            fs.unlink(err.address, StartListening);
          } else {
            done('Unkown error', e);
          }
        });

        // Try to connect
        clientSocket.connect({path: err.address}, function() {
          done(`Address (${err.address}) already in use`);
          clientSocket.unref();
        });
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
};

module.exports = serverStarter;
