import { z } from 'zod';

export const ApifyItemSchema = z
  .object({
    inputUrl: z.string().optional(),
    ownerUsername: z.string().optional(),
    type: z.enum(['Video', 'Image', 'Sidecar']).optional(),
    productType: z.string().optional(),
    url: z.string().optional(),
    timestamp: z.string().optional(),
    videoViewCount: z.number().nullish(),
    videoPlayCount: z.number().nullish(),
    likesCount: z.number().nullish(),
    commentsCount: z.number().nullish(),
    videoDuration: z.number().nullish(),
    videoUrl: z.string().nullish(),
    caption: z.string().nullish(),
    error: z.string().optional(),
    errorDescription: z.string().optional(),
  })
  .passthrough();

export type ApifyItem = z.infer<typeof ApifyItemSchema>;
