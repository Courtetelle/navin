/** The relay of NavIn (Cloudflare Worker), as the tests call it. */
interface RelayStorage {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
}

declare const relay: {
  fetch: (request: Request, env: { NAVIN?: RelayStorage }) => Promise<Response>;
  scheduled: (event: unknown, env: { NAVIN?: RelayStorage }) => Promise<void>;
};

export default relay;
