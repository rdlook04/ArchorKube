import type { OwnershipProvider } from "./types";
import { noneProvider } from "./none";
import { LOOKUP_PATHS, hasLookup } from "../templates/lookups";

/**
 * Proveedor por tabla de dueños subida a Grail: una fila por workload con su
 * squad, tier, tribu y código de aplicación. Es el camino para completar lo
 * que ni las labels ni el namespace saben (el tier, casi siempre) sin tocar
 * código ni manifiestos: Setup genera la plantilla con los workloads del
 * tenant, alguien la completa y la sube.
 *
 * Va primero en la cadena: lo que la tabla dice gana, campo por campo, y lo
 * que deja vacío lo siguen resolviendo las labels o el namespace. Mientras la
 * tabla no exista se comporta como `noneProvider` y la cadena lo descarta.
 *
 * El cruce es por nombre de workload. Si el mismo nombre existe en dos
 * namespaces, gana la primera fila; la columna namespace es para quien llena
 * la tabla.
 */
const PATH = LOOKUP_PATHS.ownership;

const table = (fields: string): string => `load "${PATH}"
    | fields ${fields}`;

export const lookupProvider: OwnershipProvider = !hasLookup("ownership")
  ? noneProvider
  : {
      id: "lookup",
      label: { en: "Ownership table (Grail)", es: "Tabla de dueños (Grail)" },
      about: {
        en: `Ownership comes from the table ${PATH}, uploaded from Setup. Empty cells are left to the next source in the chain; a workload missing from the table shows up as *(no owner)* unless another source knows it.`,
        es: `La propiedad sale de la tabla ${PATH}, subida desde Setup. Las celdas vacías quedan para la siguiente fuente de la cadena; un workload que no está en la tabla aparece *(sin dueño)* salvo que otra fuente lo conozca.`,
      },

      enrich: (sourceField, suffix = "") => {
        const s = suffix;
        return `| lookup [
    ${table("workload, squad, tier, tribu, appCode")}
  ], sourceField:${sourceField}, lookupField:workload,
     fields:{tier${s} = tier, squad${s} = squad, tribu${s} = tribu, appCode${s} = appCode}`;
      },

      // Las celdas vacías llegan como "": en los selectores son "sin valor".
      filterOptions: `${table(`squad, tier = if(tier == "", null, else: tier), tribu = if(tribu == "", null, else: tribu)`)}
| filter isNotNull(squad) and squad != ""
| summarize workloads = count(), by:{squad, tier, tribu}
| sort squad asc`,

      // Sin catálogo propio: Tiers sigue listando los workloads vivos, así se
      // ven también los que la tabla no menciona.
      catalog: null,
    };
