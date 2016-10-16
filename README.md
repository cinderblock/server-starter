# server-starter

A simple tool for starting node servers on a port and optionally hostname or a unix socket.

This tool starts a server.
If a unix socket is specified, and the file already exists, it is detected, tested to see if it is alive, and removed if it is indeed dead.
It also allows setting a file mode for the socket after creation.

## Install

```
npm install server-starter --save
```

## Usage

```
const ServerStarter = require('server-starter');

const server = new require('net').Server();

const socketOptions = {
  listen: 'path/to/socket',
  socketMode: 770,
}
const ipOptions = {
  listen: 9001,
  hostname: '127.0.0.1',
}

ServerStarter(server, options, (err, info, extra) => {
  if (err) {
    console.log(err, info, extra);
  } else {
    console.log('Listening:', info);
  }
});
```

## Options

The `listen` option allows switching between IP socket or unix socket.
Each has an optional extra setting: `hostname` and `socketMode` respectively.
