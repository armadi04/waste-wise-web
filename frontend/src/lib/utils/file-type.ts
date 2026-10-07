import {
  FileArchive,
  FileAudio,
  FileCode,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type FileKind =
  | 'image'
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'slide'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'text'
  | 'other'

interface FileTypeInfo {
  kind: FileKind
  label: string
  icon: LucideIcon
  /** Tailwind text-color class for the icon tint. */
  tint: string
  /** Whether the browser can render it inline. */
  previewable: boolean
}

const EXT_MAP: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  odt: 'doc',
  rtf: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  ods: 'sheet',
  ppt: 'slide',
  pptx: 'slide',
  odp: 'slide',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  json: 'code',
  html: 'code',
  css: 'code',
  py: 'code',
  txt: 'text',
  md: 'text',
}

const KIND_INFO: Record<FileKind, Omit<FileTypeInfo, 'kind'>> = {
  image: {
    label: 'Image',
    icon: FileImage,
    tint: 'text-emerald-500',
    previewable: true,
  },
  pdf: {
    label: 'PDF',
    icon: FileText,
    tint: 'text-red-500',
    previewable: true,
  },
  doc: {
    label: 'Document',
    icon: FileText,
    tint: 'text-blue-500',
    previewable: false,
  },
  sheet: {
    label: 'Spreadsheet',
    icon: FileSpreadsheet,
    tint: 'text-green-600',
    previewable: false,
  },
  slide: {
    label: 'Presentation',
    icon: Presentation,
    tint: 'text-orange-500',
    previewable: false,
  },
  video: {
    label: 'Video',
    icon: FileVideo,
    tint: 'text-purple-500',
    previewable: true,
  },
  audio: {
    label: 'Audio',
    icon: FileAudio,
    tint: 'text-pink-500',
    previewable: true,
  },
  archive: {
    label: 'Archive',
    icon: FileArchive,
    tint: 'text-amber-600',
    previewable: false,
  },
  code: {
    label: 'Code',
    icon: FileCode,
    tint: 'text-cyan-600',
    previewable: false,
  },
  text: {
    label: 'Text',
    icon: FileText,
    tint: 'text-default-500',
    previewable: true,
  },
  other: {
    label: 'File',
    icon: FileIcon,
    tint: 'text-default-400',
    previewable: false,
  },
}

/**
 * Classify a file by mimetype, falling back to its extension.
 *
 * The mimetype is authoritative when present — a `.bin` served as `image/png`
 * is still an image — and the extension only decides the cases MIME cannot
 * distinguish (a spreadsheet and a slide deck are both `application/*`).
 */
export function getFileType(
  name?: string | null,
  mimetype?: string | null,
): FileTypeInfo {
  let kind: FileKind = 'other'
  const mime = mimetype ?? ''
  if (mime.startsWith('image/')) kind = 'image'
  else if (mime === 'application/pdf') kind = 'pdf'
  else if (mime.startsWith('video/')) kind = 'video'
  else if (mime.startsWith('audio/')) kind = 'audio'
  else {
    const ext = name?.split('.').pop()?.toLowerCase()
    if (ext && EXT_MAP[ext]) kind = EXT_MAP[ext]
    else if (mime.startsWith('text/')) kind = 'text'
  }
  return { kind, ...KIND_INFO[kind] }
}
