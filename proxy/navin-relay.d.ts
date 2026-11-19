/** The relay of NavIn (Cloudflare Worker), as the tests call it. */
interface RelayStorage {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
}

/** Its KV and the keys kept as its secrets (each optional). */
interface RelayEnv {
  NAVIN?: RelayStorage;
  MF_KEY?: string;
  AEMET_KEY?: string;
  METOFFICE_KEY?: string;
  FROST_KEY?: string;
}

declare const relay: {
  fetch: (request: Request, env: RelayEnv) => Promise<Response>;
  scheduled: (event: unknown, env: RelayEnv) => Promise<void>;
};

export default relay;
