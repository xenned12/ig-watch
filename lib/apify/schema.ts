import { z } from 'zod';

export const ApifyItemSchema = z
  .object({
    // Real Apify items send null for absent values and may add new post types,
    // so every field accepts null and `type` is any string.
    inputUrl: z.string().nullish(),
    ownerUsername: z.string().nullish(),
    type: z.string().nullish(),
    productType: z.string().nullish(),
    url: z.string().nullish(),
    timestamp: z.string().nullish(),
    videoViewCount: z.number().nullish(),
    videoPlayCount: z.number().nullish(),
    likesCount: z.number().nullish(),
    commentsCount: z.number().nullish(),
    videoDuration: z.number().nullish(),
    videoUrl: z.string().nullish(),
    caption: z.string().nullish(),
    error: z.string().nullish(),
    errorDescription: z.string().nullish(),
  })
  .passthrough();

export type ApifyItem = z.infer<typeof ApifyItemSchema>;
