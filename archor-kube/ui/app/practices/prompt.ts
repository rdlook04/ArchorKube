import type { Lang } from "../i18n";
import { PRACTICES, practiceText, severityText } from "./catalog";

/**
 * El estándar del catálogo, como texto para un prompt de IA.
 *
 * Los prompts de cada módulo (queries/assist.ts) dicen qué mirar en la
 * evidencia; esto les suma la regla del equipo que la fila incumple, con su
 * porqué y cómo se corrige, para que la IA recomiende según el estándar y no
 * según lo que ella considere buena práctica. Es el mismo texto de la Guía:
 * si una práctica cambia en el catálogo, cambia también aquí.
 *
 * Solo lleva texto del catálogo, nunca datos de la fila, así que no necesita
 * pasar por el filtro (igual lo recorre, porque va pegado al prompt).
 */

const INTRO = {
  en: "Our best-practice standard (the team's catalog) says this workload fails the following. Base your recommendation on it, and if the data contradicts a rule, say so:",
  es: "Nuestro estándar de buenas prácticas (el catálogo del equipo) dice que este workload incumple lo siguiente. Basa tu recomendación en él y, si los datos contradicen una regla, dilo:",
};

const LABELS = {
  en: { why: "Why", fix: "How to fix", caveat: "Caveat", owner: "Usually fixed by" },
  es: { why: "Por qué", fix: "Cómo se corrige", caveat: "Matiz", owner: "Suele corregirla" },
};

/** Sección "estándar" para las prácticas indicadas; vacía si no hay ninguna. */
export const standardSection = (practiceIds: string[], lang: Lang): string => {
  const practices = PRACTICES.filter((p) => practiceIds.includes(p.id));
  if (practices.length === 0) return "";
  const label = LABELS[lang];
  const items = practices.map((practice, i) => {
    const text = practiceText(practice, lang);
    const code = practice.code ? ` (${practice.code})` : "";
    const lines = [
      `${i + 1}. ${text.title}${code}, ${severityText(practice.severity, lang).label}.`,
      `   ${label.why}: ${text.why}`,
      `   ${label.fix}: ${text.howTo.join(" ")}`,
      ...(text.caveat ? [`   ${label.caveat}: ${text.caveat}`] : []),
      `   ${label.owner}: ${text.owner}.`,
    ];
    return lines.join("\n");
  });
  return `\n\n${INTRO[lang]}\n${items.join("\n")}`;
};
