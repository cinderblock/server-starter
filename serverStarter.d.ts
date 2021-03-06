import { AddressInfo } from 'net';

export = ServerStarter;

declare namespace ServerStarter {
  const prototype: {};

  type ServerStarterOptions =
    | {
        listen: string;
        socketMode: number;
        socketOwner: {
          user: number | string;
          group: number | string;
        };
      }
    | {
        listen: number;
        hostname?: string;
      };
}

declare function ServerStarter<T, F extends (...args: any[]) => void>(
  server: {
    address: () => T;
    listen:
      | ((listen: number, bind?: string) => any)
      | ((listen: string) => any);
    once: (event: 'error' | 'listening', cb: F) => any;
    removeListener: (event: 'error' | 'listening', cb: F) => any;
  },
  config: ServerStarter.ServerStarterOptions,
  callback: (err: null | Error | string, info: T | Error, extra?: Error) => any
): undefined;
