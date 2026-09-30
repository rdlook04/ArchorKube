import { runQuery } from "../setup/runQuery";

/**
 * Tablas que la organización sube a Grail como lookup para completar lo que el
 * tenant no sabe (dueños y tiers, precios). Viven todas bajo un mismo prefijo
 * para que se reconozcan en Settings → Storage management → Grail files.
 */
export const LOOKUP_PATHS = {
  ownership: "/lookups/archorkube/ownership",
  prices: "/lookups/archorkube/prices",
} as const;

export type LookupId = keyof typeof LOOKUP_PATHS;

const available = new Set<LookupId>();

/**
 * Si la tabla existe. Se decide una vez, al abrir la app: leer con `load` una
 * tabla que no existe hace fallar la consulta entera, así que ninguna consulta
 * la menciona si no está.
 */
export const hasLookup = (id: LookupId): boolean => available.has(id);

/**
 * Prueba cada tabla con un `load … | limit 1`. Corre antes de que carguen los
 * módulos que arman las consultas (ver `main.tsx`). Si algo falla o tarda, la
 * tabla cuenta como ausente: la app funciona igual, sin ella.
 */
export const detectLookups = async (timeoutMs = 8000): Promise<void> => {
  const probe = async (id: LookupId) => {
    try {
      await runQuery(`load "${LOOKUP_PATHS[id]}" | limit 1`, 1);
      available.add(id);
    } catch {
      // Ausente, sin permiso o tenant lento: se sigue sin la tabla.
    }
  };
  const all = Promise.all((Object.keys(LOOKUP_PATHS) as LookupId[]).map(probe));
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
};
