export function migrate(client: { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }, log?: (msg: string) => void): Promise<void>;
export function sslOption(url: string): false | { rejectUnauthorized: boolean };
