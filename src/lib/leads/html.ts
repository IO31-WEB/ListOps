export const oneLine = (s: string, max = 200) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max)
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
