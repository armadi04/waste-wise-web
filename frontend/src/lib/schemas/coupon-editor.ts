import { z } from 'zod'

export const couponEditorSchema = z.object({
  images: z.preprocess(
    (value) =>
      Array.isArray(value)
        ? value.filter(
            (item) => typeof item?.url !== 'string' || item.url.trim() !== '',
          )
        : value,
    z
      .array(
        z.object({
          url: z
            .url()
            .refine(
              (value) => /^https?:\/\//.test(value),
              'Use an HTTP or HTTPS image URL',
            )
            .max(255),
          alt: z.string().max(240),
        }),
      )
      .min(1, 'Add at least one photo')
      .max(10, 'Use at most 10 photos'),
  ),
  packages: z
    .array(
      z.object({
        publicId: z.string().uuid().optional(),
        name: z.string().trim().min(1, 'Enter a package name').max(180),
        benefits: z.string(),
        price: z.number().int().nonnegative(),
        oldPrice: z.number().int().nonnegative().nullable(),
        stockTotal: z.number().int().nonnegative(),
        active: z.boolean(),
      }),
    )
    .min(1, 'Add at least one package')
    .max(30),
})
