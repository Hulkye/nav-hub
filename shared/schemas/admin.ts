import { z } from 'zod'

export const adminLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(256)
  })
  .strict()

export type AdminLoginInput = z.infer<typeof adminLoginSchema>
