import {
  REGISTER_METHODS,
  REGISTER_METHOD_LABEL,
} from '@/lib/constants/register-method'

export const DATE_OPTIONS = [
  { key: 'all', label: 'Semua' },
  { key: 'today', label: 'Per hari ini' },
  { key: '7d', label: '7 hari terakhir' },
  { key: '1m', label: '1 bulan terakhir' },
  { key: '3m', label: '3 bulan terakhir' },
]

export const METHOD_OPTIONS = [
  { key: 'all', label: 'Semua metode daftar' },
  ...REGISTER_METHODS.map((key) => ({
    key,
    label: REGISTER_METHOD_LABEL[key],
  })),
]
