/** Shared zod schemas for the commercial routes (server-side validation of every client field). */
import { z } from 'zod'
import { cleanText } from '@/lib/listing-schemas'

/** Short free-text field that will be shown to / sent to the AI: single line, no control chars, max 80. */
const shortText = z.string().transform(s => cleanText(s).replace(/\s+/g, ' ')).pipe(z.string().max(80)).optional()

export const OmBuilderBody = z.object({
  reportId: z.string().uuid(),
  propertyType: shortText,
  askingPrice: shortText,
  capRate: shortText,
})

export const OmSectionBody = OmBuilderBody.extend({ section: z.string().max(60) })

export const OmPdfBody = z.object({
  sections: z.record(z.string().max(60), z.string().max(30_000)).refine(o => { const n = Object.keys(o).length; return n >= 1 && n <= 20 }),
  propertyType: shortText,
  askingPrice: shortText,
  capRate: shortText,
  reportId: z.string().uuid().optional(),
})
