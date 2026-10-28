/** CSV export with spreadsheet-formula-injection protection (a lead named "=HYPERLINK(...)" must not run in Excel). */

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',')

export const LEAD_CSV_HEADER = [
  'Received', 'Type', 'Status', 'Name', 'Email', 'Phone', 'Property', 'Preferred date', 'Preferred time',
  'Message', 'Source', 'Medium', 'Campaign tag', 'Referrer', 'Consent given',
]

export interface LeadCsvRow {
  createdAt: Date; kind: string; status: string; name: string; email: string; phone: string | null
  property: string; preferredDate: string | null; preferredTime: string | null; message: string | null
  source: string | null; medium: string | null; campaignTag: string | null; referrerHost: string | null; consentAt: Date
}

export function leadsToCsv(rows: LeadCsvRow[]): string {
  const lines = [csvRow(LEAD_CSV_HEADER)]
  for (const r of rows) {
    lines.push(csvRow([
      r.createdAt.toISOString(), r.kind === 'showing' ? 'Showing request' : 'Info request', r.status, r.name, r.email,
      r.phone, r.property, r.preferredDate, r.preferredTime, r.message, r.source ?? 'direct', r.medium, r.campaignTag,
      r.referrerHost, r.consentAt.toISOString(),
    ]))
  }
  return lines.join('\r\n') + '\r\n'
}
