# ArchorKube

*Español · [English](README.en.md)*

Una app de Dynatrace que revisa buenas prácticas de Kubernetes y **le pone dueño a cada hallazgo**.

> **El nombre.** *Arch* de arquitectura y *arconte* —del griego *arkhon*, «el que gobierna»: los magistrados que orquestaban el estado— sobre *Kube*rnetes. No es un tablero más que reporta: es el que manda en la cola, poniéndole dueño, criticidad y orden de atención a cada hallazgo.

Un cluster grande no tiene un problema de detección: tiene un problema de asignación. Las herramientas encuentran cientos de workloads mal dimensionados, sin réplicas o tirando OOM, y esa lista muere en un dashboard porque nadie sabe cuál es suyo ni cuál importa primero. ArchorKube resuelve esa parte: cruza cada hallazgo con el equipo dueño y su criticidad de negocio, y entrega **una cola priorizada por squad** en vez de un inventario de problemas.

Corre sobre AppEngine y consulta Grail con DQL. No instala nada en tus clusters.

---

## Los módulos

| # | Módulo | Qué encuentra |
|---|---|---|
| M1/M2 | Rightsizing CPU y memoria | Workloads que piden mucho más de lo que usan, valorizado en USD/mes |
| M3 | Ociosos | Workloads sin tráfico ni consumo, candidatos a escalar a cero |
| M4 | Densidad | Utilización real de nodos y cluster |
| M5 | Riesgo de caída | Réplica única, sin probes, sin HPA |
| M6 | Huérfanos | Escalados a cero y olvidados, o corriendo sin dueño identificable |
| M7 | Tieraje | El inventario de propiedad que prioriza todo lo demás, y la lista de workloads sin tier repartida por squad |
| M8 | Detección preventiva | Reinicios y OOMKilled antes de que sean incidente |
| M9 | Errores críticos | Errores por workload y namespace, desde logs |
| M10 | Control plane | Salud y condiciones de los nodos |
| M11 | Cuellos de botella | CPU throttling y saturación |
| M12 | Cumplimiento | Las 8 SPECs del estándar AKS por workload: limits, requests, probes, non-root, Helm |
| — | Gasto | Inventario de nodos prorrateado por nodo-día |

Cada módulo trae su propia explicación dentro de la app: qué muestra, por qué importa y qué hacer con el resultado. La consulta DQL que se ejecutó es visible en cada página.

---

## Lo que lo hace distinto: la capa de propiedad

Todo lo anterior lo hace, de una forma u otra, cualquier herramienta de FinOps. La diferencia está en **cómo ArchorKube averigua de quién es cada workload**, porque de ahí sale la priorización.

No asume que tienes un catálogo de servicios. La fuente de propiedad es intercambiable:

| Proveedor | Cuándo usarlo |
|---|---|
| **Labels / annotations** | Tus workloads están etiquetados. Es el default. |
| **Convención de namespace** | El namespace es el equipo. Sin gobierno, acierta más de lo que parece. |
| **Mapeo manual** | Reglas declaradas a mano. Funciona siempre, sirve de excepciones. |
| **Sin propiedad** | Todos los análisis corren igual; solo se pierde el agrupado por equipo. |

Y se **encadenan**, resolviendo campo por campo:

```ts
export const ownership = chainProviders(
  manualProvider(excepciones),  // primero las correcciones a mano
  labelsProvider,               // luego lo que diga el propio workload
  namespaceProvider,            // y si no, al menos el namespace
);
```

Eso importa porque nadie llega con el 100 % de sus workloads etiquetados. Un workload puede sacar el squad de su label y el tier de una regla manual. Y lo que no resuelve nadie **queda visible como *(sin dueño)*** en vez de asignarse a alguien al azar — esa fila suele ser el hallazgo más accionable de todos.

La convención por defecto se apoya en las labels recomendadas de Kubernetes:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: checkout-api
    app.kubernetes.io/part-of: payments
    archorkube.io/tier: "1"
    archorkube.io/owner: squad-payments
    archorkube.io/domain: commerce
```

Si tu organización ya tiene sus propias claves (`team`, `cost-center`, `backstage.io/owner`…), se cambian en un solo sitio y no hay que reetiquetar nada. Y si tienes un IDP —Backstage, Port, un CMDB—, se escribe un proveedor nuevo: es una interfaz de cuatro métodos.

Ver [docs/OWNERSHIP.md](docs/OWNERSHIP.md).

---

## Arrancar

Requiere Node 24 y un tenant de Dynatrace con Kubernetes monitoreado.

```bash
git clone https://github.com/rdlook04/ArchorKube.git
cd ArchorKube/archor-kube
cp .env.example .env                                  # tu tenant
cp ui/app/ownership/active.ts.example ui/app/ownership/active.ts   # tu(s) proveedor(es) de propiedad
cp ui/app/config/site.ts.example ui/app/config/site.ts             # tus namespaces y precios
npm install
npm start
```

Ninguno de esos tres archivos se commitea (están en `.gitignore`) — son configuración de tu instalación, no del proyecto.

Para desplegarla en tu tenant:

```bash
npm run deploy
```

Antes de confiar en los números, dos cosas que dependen de tu entorno:

1. **Verifica que llegan las labels.** En un notebook: `describe dt.entity.cloud_application` y busca `cloudApplicationLabels` / `kubernetesAnnotations`. Si no están, tu operador no las envía — usa el proveedor `manual` o `namespace`. (Cuidado: **no** es `kubernetesLabels`; ese campo no existe y usarlo hace fallar la consulta entera.)
2. **Pon tus precios.** El modelo de costo trae valores de orden de magnitud. Los tipos de instancia de tu flota y su precio van en `ui/app/config/site.ts`; sin eso, el gasto sale como desconocido en vez de mal calculado.

---

## Configurar

Tres archivos, y ninguno más — cada uno con su `.example` versionado, igual que `.env`:

| Archivo | Se copia de | Qué decide |
|---|---|---|
| `ui/app/ownership/active.ts` | `active.ts.example` | Qué proveedor(es) de propiedad se usan y en qué orden |
| `ui/app/ownership/port.ts` | `port.ts.example` (opcional) | Tu conector a un catálogo propio (Backstage, un CMDB…), si tenés uno |
| `ui/app/config/site.ts` | `site.ts.example` | Namespaces excluidos, precios de instancias |
| `archor-kube/.env` | `.env.example` | A qué tenant apunta |

Ninguno se commitea. Cualquier mejora fuera de estos tres archivos vale para todo el mundo que use el repo — esa es la disciplina que mantiene la app genérica en vez de ir acumulando supuestos de una sola organización.

---

## Contribuir

Se agradece, y hay [issues abiertos](../../issues) marcados `good first issue`.

Lo más útil que puedes aportar: **un proveedor de propiedad nuevo**. Si tu organización resuelve el dueño de un workload de una forma que aquí no está —Backstage, un CMDB, una convención de nombres, etiquetas de la nube—, ese adaptador le sirve a mucha gente. Son unas 40 líneas: implementa `OwnershipProvider` en `ui/app/ownership/`.

El harness antes de abrir un PR:

```bash
npm run verify
```

---

## Estado

Los módulos M1–M12 y la vista de gasto están implementados y validados contra un cluster de producción real. La app se despliega y corre.

Lo que **no** está resuelto y conviene saber antes de usarla en serio:

- El nombre de las propiedades de entidad donde viven labels y annotations varía según la versión del operador de Kubernetes. El proveedor de labels está verificado contra un tenant real, pero conviene confirmarlo en el tuyo con `describe`.
- El match entre workload y catálogo es por nombre exacto. Los nombres que no coinciden quedan sin dueño; no hay match difuso.
- El modelo de costo prorratea CPU y memoria 50/50. Es una aproximación razonable, no una factura.
