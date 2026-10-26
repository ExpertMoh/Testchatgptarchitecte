import data from './reference-data.json';
import { ProjectSchema } from './schema';
import type { Project } from './schema';
export function createReferenceProject():Project {
  return ProjectSchema.parse(structuredClone(data));
}

export const CURRENT_REFERENCE_REVISION=data.reference.revision;
