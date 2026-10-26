import { z } from 'zod';

export const EvidenceSchema = z.object({
  status: z.enum(['confirmed', 'inferred', 'unknown']),
  sourceId: z.string().max(160).nullable(),
  note: z.string().max(2000),
});
const finite = z.number().finite().min(-100000).max(100000);
export const MeasureSchema = EvidenceSchema.extend({ value: finite.nullable() }).superRefine((v, ctx) => {
  if (v.status === 'unknown' && v.value !== null) ctx.addIssue({ code: 'custom', message: 'Une mesure inconnue doit rester vide.' });
  if (v.status !== 'unknown' && (v.value === null || !v.sourceId)) ctx.addIssue({ code: 'custom', message: 'Une mesure renseignée exige une valeur et une source.' });
});
export const PointSchema = z.object({ x: MeasureSchema, y: MeasureSchema });
const asset = z.string().max(28000000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional();
const SourceSchema = z.object({
  id: z.string().max(160), name: z.string().max(300), kind: z.enum(['demo', 'image', 'pdf', 'reference', 'survey']),
  description: z.string().max(2000), image: asset,
  pixelWidth: z.number().int().positive().max(40000).optional(), pixelHeight: z.number().int().positive().max(40000).optional(),
  page: z.number().int().positive().optional(),
});
const CalibrationSchema = z.object({
  metersPerPixel: z.number().finite().positive().max(100),
  pixelA: z.object({ x: finite, y: finite }), pixelB: z.object({ x: finite, y: finite }),
  distance: MeasureSchema,
  origin: z.object({ x: finite, y: finite }).optional(),
  rotation: z.number().finite().min(-Math.PI).max(Math.PI).optional(),
});
export const WallSchema = z.object({ id: z.string(), name: z.string().max(160), start: PointSchema, end: PointSchema, thickness: MeasureSchema, footprint: z.array(PointSchema).length(4).optional() });
export const OpeningSchema = z.object({
  id: z.string(), name: z.string().max(160), kind: z.enum(['door', 'window']), wallId: z.string(),
  offset: MeasureSchema, width: MeasureSchema, height: MeasureSchema, sill: MeasureSchema,
  hinge: z.enum(['start', 'end']).optional(), swing: z.union([z.literal(-1), z.literal(1)]).optional(),
});
const RoomSchema = z.object({ id: z.string(), name: z.string().max(160), points: z.array(PointSchema).min(3).max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), kind: z.enum(['interior','exterior','unverified']).optional(), controlDimensions: z.array(z.object({label:z.string(),expected:MeasureSchema,from:z.number().int().min(0),to:z.number().int().min(0)})).optional() });
const StairSchema = z.object({ id: z.string(), name: z.string().max(160), start: PointSchema, end: PointSchema, width: MeasureSchema, footprint: z.array(PointSchema).min(3).max(100).optional(), path: z.array(PointSchema).min(2).max(100).optional() });
export const FloorSchema = z.object({
  id: z.string(), name: z.string().max(160), shortName: z.string().max(30), elevation: MeasureSchema, height: MeasureSchema,
  walls: z.array(WallSchema).max(2000), openings: z.array(OpeningSchema).max(2000), rooms: z.array(RoomSchema).max(300), stairs: z.array(StairSchema).max(100),
  sourceId: z.string().nullable(), sourceVisible: z.boolean(), sourceOpacity: z.number().min(0).max(1),
  calibration: CalibrationSchema.nullable(),
});
export const ProjectSchema = z.object({
  schemaVersion: z.literal(1), id: z.string(), name: z.string().max(200), demonstration: z.boolean(),
  reference: z.object({ documentName: z.string(), sha256: z.string(), pageCount: z.number().int(), revision: z.string(), adjustments: z.array(z.object({floorId:z.string(),sourceId:z.string(),method:z.string(),details:z.string()})).optional(), limitations: z.array(z.string()) }).optional(),
  sources: z.array(SourceSchema).max(100), floors: z.array(FloorSchema).min(1).max(50),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Measure = z.infer<typeof MeasureSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Stair = z.infer<typeof StairSchema>;
export type Floor = z.infer<typeof FloorSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type XY = { x: number; y: number };
export type Selection = { kind: 'wall' | 'room' | 'opening' | 'stair'; id: string } | null;
export const uid = () => crypto.randomUUID();
export const unknown = (note = 'À mesurer sur une source vérifiée.'): Measure => ({ value: null, status: 'unknown', sourceId: null, note });
export const measure = (value: number, sourceId = 'demo', status: Evidence['status'] = 'inferred', note = 'Donnée de démonstration fictive.'): Measure => ({ value, sourceId, status, note });
export const point = (x: number, y: number, sourceId = 'demo', note = 'Géométrie de démonstration fictive.'): Point => ({ x: measure(x, sourceId, 'inferred', note), y: measure(y, sourceId, 'inferred', note) });
