import type { KinshipDialect, KinshipTable } from "../kinship";
import { en } from "./en";
import { id } from "./id";
import { jvYogya } from "./jv-yogya";
import { ms } from "./ms";

export const KINSHIP_TERMS: Record<KinshipDialect, KinshipTable> = { id, "jv-yogya": jvYogya, ms, en };
export const KINSHIP_DIALECTS: readonly KinshipDialect[] = ["id", "jv-yogya", "ms", "en"];
