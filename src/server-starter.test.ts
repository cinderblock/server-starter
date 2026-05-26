import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:net';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

import { startServer } from './server-starter.js';

const isWindows = platform() === 'win32';

describe('TCP', () => {
  it('listens on a random port and returns the address', async () => {
    const server = createServer();
    try {
      const addr = (await startServer(server, { listen: 0, hostname: '127.0.0.1' })) as AddressInfo;
      assert.equal(typeof addr.port, 'number');
      assert.ok(addr.port > 0);
      assert.equal(addr.address, '127.0.0.1');
    } finally {
      await new Promise<void>(r => server.close(() => r()));
    }
  });

  it('rejects when the port is already taken', async () => {
    const a = createServer();
    const aAddr = (await startServer(a, { listen: 0, hostname: '127.0.0.1' })) as AddressInfo;
    try {
      const b = createServer();
      try {
        await assert.rejects(
          () => startServer(b, { listen: aAddr.port, hostname: '127.0.0.1' }),
          /already in use/i,
        );
      } finally {
        await new Promise<void>(r => b.close(() => r()));
      }
    } finally {
      await new Promise<void>(r => a.close(() => r()));
    }
  });

  it('omits hostname when not provided (binds to default interface)', async () => {
    const server = createServer();
    try {
      const addr = (await startServer(server, { listen: 0 })) as AddressInfo;
      assert.ok(addr.port > 0);
    } finally {
      await new Promise<void>(r => server.close(() => r()));
    }
  });
});

// Unix sockets aren't supported on Windows the same way (NamedPipe paths differ).
// Skip the unix-socket tests there.
describe('unix socket', { skip: isWindows }, () => {
  it('listens on a unix socket path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ss-test-'));
    try {
      const path = join(dir, 'sock');
      const server = createServer();
      try {
        await startServer(server, { listen: path });
        const s = await stat(path);
        assert.ok(s.isSocket());
      } finally {
        await new Promise<void>(r => server.close(() => r()));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('removes a stale socket file and retries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ss-test-'));
    try {
      const path = join(dir, 'sock');
      // Pre-populate a non-socket file at the path: the listen attempt will
      // fail with EADDRINUSE (well, EEXIST for a regular file — verifying).
      // Actually for unix-sockets, listen() will fail if the path exists.
      await writeFile(path, '');
      const server = createServer();
      try {
        await startServer(server, { listen: path });
        const s = await stat(path);
        assert.ok(s.isSocket(), 'replaced stale file with a real socket');
      } finally {
        await new Promise<void>(r => server.close(() => r()));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('applies socketMode after listening', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ss-test-'));
    try {
      const path = join(dir, 'sock');
      const server = createServer();
      try {
        await startServer(server, { listen: path, socketMode: 0o600 });
        const s = await stat(path);
        // Only owner bits will match; group/other might be masked by umask.
        assert.equal((s.mode & 0o600), 0o600);
        assert.equal((s.mode & 0o077), 0);
      } finally {
        await new Promise<void>(r => server.close(() => r()));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
