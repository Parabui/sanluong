import { z } from 'zod';

/** GET /api/health — công khai, chỉ trả { ok } [D24] */
export const zHealth = z.object({ ok: z.literal(true) });
export type Health = z.infer<typeof zHealth>;
