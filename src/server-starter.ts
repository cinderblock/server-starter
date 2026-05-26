import { chmod, chown, stat, unlink } from 'node:fs/promises';
import { Socket } from 'node:net';
import { createRequire } from 'node:module';

/** Anything that walks like a `net.Server`. */
export interface Listenable<TAddr = unknown> {
  listen(...args: unknown[]): unknown;
  address(): TAddr;
  once(event: 'listening' | 'error', cb: (err?: NodeJS.ErrnoException) => void): unknown;
  removeListener(event: 'listening' | 'error', cb: (err?: NodeJS.ErrnoException) => void): unknown;
}

export interface TCPListenOptions {
  /** TCP port to listen on. */
  listen: number;
  /** Hostname/interface (e.g. "127.0.0.1"). Default: all interfaces. */
  hostname?: string;
}

export interface UnixSocketListenOptions {
  /** Unix socket path. */
  listen: string;
  /** Mode to chmod the socket to after listening. Octal recommended (e.g. 0o770). */
  socketMode?: number;
  /** Owner to chown the socket to after listening. */
  socketOwner?: {
    /** Numeric uid, or username (requires the optional `userid` peer dep). */
    user?: number | string;
    /** Numeric gid, or group name (requires the optional `userid` peer dep). */
    group?: number | string;
  };
}

export type StartServerOptions = TCPListenOptions | UnixSocketListenOptions;

/** Start a server listening on a TCP port or unix socket. Resolves to the
 *  server's address when it's listening. For unix sockets: if the path is
 *  already in use but no process is actually listening there, the stale
 *  socket file is removed and listening is retried. Optional chmod/chown
 *  happens after the listening event fires. */
export async function startServer<TAddr>(
  server: Listenable<TAddr>,
  opts: StartServerOptions,
): Promise<TAddr> {
  await listenWithStaleSocketHandling(server, opts);

  // For unix sockets, apply chmod / chown if requested.
  if (typeof opts.listen === 'string') {
    const socketOpts = opts as UnixSocketListenOptions;
    if (socketOpts.socketOwner) {
      const { user, group } = await resolveSocketOwner(socketOpts.socketOwner);
      if (user !== undefined || group !== undefined) {
        await chown(
          socketOpts.listen,
          user ?? process.getuid?.() ?? -1,
          group ?? process.getgid?.() ?? -1,
        );
      }
    }
    if (socketOpts.socketMode !== undefined) {
      await chmod(socketOpts.listen, socketOpts.socketMode);
    }
  }

  return server.address();
}

async function listenWithStaleSocketHandling(
  server: Listenable<unknown>,
  opts: StartServerOptions,
): Promise<void> {
  try {
    await listenOnce(server, opts);
    return;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'EADDRINUSE') throw err;
    // Only attempt stale-socket cleanup for unix sockets.
    if (typeof opts.listen !== 'string') {
      throw new Error(
        `Address (${(e as NodeJS.ErrnoException & { address?: string; port?: number }).address ?? ''} ${(e as NodeJS.ErrnoException & { port?: number }).port ?? ''}) already in use`,
      );
    }
    const socketPath = opts.listen;
    const inUse = await isSocketActive(socketPath);
    if (inUse) {
      throw new Error(`Address (${socketPath}) already in use`);
    }
    await unlink(socketPath);
    await listenOnce(server, opts);
  }
}

function listenOnce(server: Listenable<unknown>, opts: StartServerOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    const onError = (err?: NodeJS.ErrnoException) => {
      server.removeListener('listening', onListening);
      reject(err ?? new Error('Unknown listen error'));
    };
    server.once('listening', onListening);
    server.once('error', onError);
    if (typeof opts.listen === 'string') {
      server.listen(opts.listen);
    } else {
      const ipOpts = opts as TCPListenOptions;
      if (ipOpts.hostname !== undefined) {
        server.listen(ipOpts.listen, ipOpts.hostname);
      } else {
        server.listen(ipOpts.listen);
      }
    }
  });
}

/** Try to connect to a unix socket path to see if a process is actually
 *  listening on it (true) or it's stale (false). */
async function isSocketActive(path: string): Promise<boolean> {
  try {
    await stat(path);
  } catch {
    return false; // No file at all.
  }
  return new Promise<boolean>(resolve => {
    const client = new Socket();
    client.once('error', (err: NodeJS.ErrnoException) => {
      client.destroy();
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
        resolve(false); // Stale socket — no listener.
      } else {
        resolve(true); // Some other error; conservatively assume it's alive.
      }
    });
    client.connect({ path }, () => {
      client.destroy();
      resolve(true);
    });
  });
}

async function resolveSocketOwner(
  owner: NonNullable<UnixSocketListenOptions['socketOwner']>,
): Promise<{ user?: number; group?: number }> {
  let user: number | undefined;
  let group: number | undefined;
  if (typeof owner.user === 'number' && Number.isInteger(owner.user) && owner.user >= 0) {
    user = owner.user;
  } else if (typeof owner.user === 'string') {
    user = (await loadUserid()).uid(owner.user);
  }
  if (typeof owner.group === 'number' && Number.isInteger(owner.group) && owner.group >= 0) {
    group = owner.group;
  } else if (typeof owner.group === 'string') {
    group = (await loadUserid()).gid(owner.group);
  }
  return { user, group };
}

interface UseridModule {
  uid(name: string): number;
  gid(name: string): number;
}

let cachedUserid: UseridModule | undefined;
async function loadUserid(): Promise<UseridModule> {
  if (cachedUserid) return cachedUserid;
  // userid is a CJS native module; load via createRequire from this ESM file.
  const localRequire = createRequire(import.meta.url);
  try {
    cachedUserid = localRequire('userid') as UseridModule;
    return cachedUserid;
  } catch (err) {
    throw new Error(
      'Resolving socketOwner.user/group by name requires the optional `userid` package. ' +
        '`npm install userid` to enable it, or pass numeric uid/gid directly.',
      { cause: err as Error },
    );
  }
}

export default startServer;
