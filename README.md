# server-starter

A simple tool for starting node servers on a port and optionally hostname or a unix socket.

This tool starts a server.
If a unix socket is specified, and the file already exists, it is detected, tested to see if it is alive, and removed if it is indeed dead.
It also allows setting a file mode and owner for the socket after creation.

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
  socketMode: 0770,
  socketOwner: {
    user: 1000,
    group: 1000,
  }
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

You can use strings for `socketOwner` `user` or `group` if the optional npm dependency `userid` is installed.

## Options

The `listen` option allows switching between IP socket or unix socket.
Each has an optional extra settings.

### IP Options
 - `listen` *`Integer`* Port to listen on
 - `hostname` *`String`*

### Socket Options
 - `listen` *`String`* Specify socket filename
 - `socketMode` *`Integer`* passed to `fs.chmod` - octal notation is easiest
 - `socketOwner` passed to `fs.chown`
   - `user` *`Integer`* or *`String`* if `userid` is installed
   - `group` *`Integer`* or *`String`* if `userid` is installed
