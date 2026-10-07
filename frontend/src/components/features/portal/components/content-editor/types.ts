export type DataField = {
  name: string
  label: string
  kind: 'text' | 'lines' | 'select'
  options?: Array<string>
  description?: string
}
