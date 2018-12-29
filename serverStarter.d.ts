export type ServerStarterOptions =
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

export default function serverStarter(
  server: {
    listen:
      | ((listen: number, bind?: string) => any)
      | ((listen: string) => any);
    once: (event: 'error' | 'listening', cb: (...args: any[]) => any) => any;
  },
  config: ServerStarterOptions,
  callback: (err: boolean, info: string, extra?: string) => void
): void;
