# server-starter

Start a node server listening on a TCP port or unix socket. For unix sockets: detects stale socket files, removes them, and retries. After listening, applies `chmod`/`chown` to the socket file if requested.

Promise-based, TypeScript-typed, ESM-only.

## Install

```sh
npm install server-starter
```

If you want to resolve `socketOwner.user`/`group` by name rather than uid/gid, also install the optional native dep:

```sh
npm install userid
```

## Usage

```ts
import { createServer } from 'node:net';
import { startServer } from 'server-starter';

const server = createServer();

// TCP:
const addr = await startServer(server, {
  listen: 9001,
  hostname: '127.0.0.1',
});
console.log('Listening on', addr); // { address, port, family }

// Unix socket:
await startServer(server, {
  listen: '/run/myapp.sock',
  socketMode: 0o770,
  socketOwner: { user: 'myapp', group: 'www-data' },
});
```

If the socket path already exists, `server-starter` will probe it: if a process is actively accepting connections there, listening fails; if not, the stale socket file is removed and listening retries.

## API

### `startServer(server, options): Promise<AddressInfo | string>`

`server` is anything with `listen` / `address` / `once('listening'|'error')` / `removeListener`. A `net.Server` works; an `http.Server` works; a streams-friendly mock works.

`options` is one of:

**TCP**:
- `listen` (number) — port (`0` to pick any).
- `hostname` (string, optional) — interface to bind to. Default: all interfaces.

**Unix socket**:
- `listen` (string) — socket path.
- `socketMode` (number, optional) — applied via `fs.chmod` after listening.
- `socketOwner` (`{ user?, group? }`, optional) — applied via `fs.chown`. `user`/`group` can be numeric (uid/gid) or strings (resolved via the optional `userid` package).

Resolves to the server's `.address()` value.

## Migration from 1.x

The 1.x API was a callback-style function:

```js
const ServerStarter = require('server-starter');
ServerStarter(server, options, (err, info) => { ... });
```

In 2.x:

```ts
import { startServer } from 'server-starter';
try {
  const info = await startServer(server, options);
} catch (err) {
  // ...
}
```

Behavior changes:
- ESM-only (Node 22+ supports `require(ESM)` for non-async-top-level modules).
- Returns a Promise instead of taking a callback. No third `extra` argument — original errors propagate via the rejection chain.
- `socketOwner.user` and `.group` are now individually optional. Pass only the one you want to set.
- TypeScript types are generated from the source, not hand-maintained.

## Requirements

- Node.js >= 22.

## License

MIT.
