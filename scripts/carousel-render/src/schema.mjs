// zod schemas for tokens.json and slides.json. Lenient (.passthrough) so the
// token spec can grow, but strict enough to give a helpful error path on the
// fields the renderer actually depends on.

import { z } from 'zod';

const Leaf = z.union([
  z.string(),
  z.number(),
  z.object({ $value: z.any() }).passthrough(),
]);

export const TokensSchema = z
  .object({
    meta: z.any().optional(),
    canvas: z
      .object({
        width: Leaf.optional(),
        height: Leaf.optional(),
        safeArea: z.any().optional(),
      })
      .passthrough()
      .optional(),
    color: z.record(z.any()).optional(),
    typography: z
      .object({
        fontFamilies: z.record(z.any()).optional(),
        roles: z.record(z.any()).optional(),
      })
      .passthrough()
      .optional(),
    layout: z.any().optional(),
    imagery: z.any().optional(),
    motifs: z.any().optional(),
  })
  .passthrough();

const Background = z
  .object({
    mode: z.enum(['solid', 'gradient', 'image']).default('solid'),
    color: z.string().optional(),
    gradient: z
      .object({ angle: z.string().optional(), stops: z.array(z.string()).min(2) })
      .optional(),
    image: z.string().optional(),
    overlay: z.string().optional(),
  })
  .passthrough();

const Slide = z
  .object({
    template: z.enum(['cover', 'body', 'quote', 'list', 'cta']),
    name: z.string().optional(),
    background: Background.optional(),
    slots: z.record(z.any()).default({}),
    highlights: z.array(z.string()).optional(),
    showPageNum: z.boolean().optional(),
    imagery_note: z.string().optional(),
  })
  .passthrough();

export const SlidesSchema = z.union([
  z.array(Slide),
  z.object({ meta: z.any().optional(), slides: z.array(Slide).min(1) }).passthrough(),
]);

export function normalizeSlides(parsed) {
  return Array.isArray(parsed) ? parsed : parsed.slides;
}
