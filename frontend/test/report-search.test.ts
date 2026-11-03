import { describe, expect, it } from 'vitest'
import { reportSearchSchema } from '@/lib/schemas/reports'
import {
  REPORT_STATUS_TRANSITIONS,
  WASTE_CATEGORY_LABEL,
} from '@/lib/constants/reports'
import { getColumns } from '@/components/features/reports/components/table-columns'

describe('report search schema', () => {
  it('coerces numeric URL values used by the table', () => {
    const parsed = reportSearchSchema.parse({
      page: '2',
      limit: '50',
      reporterId: '7',
      status: 'IN_PROGRESS',
      category: 'PLASTIC_WASTE',
    })

    expect(parsed).toMatchObject({
      page: 2,
      limit: 50,
      reporterId: 7,
      status: 'IN_PROGRESS',
      category: 'PLASTIC_WASTE',
    })
  })

  it('keeps optional filters absent for a refresh-safe default URL', () => {
    expect(reportSearchSchema.parse({})).toEqual({})
  })
})

describe('report domain helpers', () => {
  it('mirrors the backend transition graph', () => {
    expect(REPORT_STATUS_TRANSITIONS.PENDING).toEqual([
      'IN_PROGRESS',
      'REJECTED',
    ])
    expect(REPORT_STATUS_TRANSITIONS.IN_PROGRESS).toEqual([
      'COMPLETED',
      'REJECTED',
    ])
    expect(REPORT_STATUS_TRANSITIONS.COMPLETED).toEqual([])
    expect(REPORT_STATUS_TRANSITIONS.REJECTED).toEqual([])
  })

  it('always exposes a text label for categories', () => {
    expect(WASTE_CATEGORY_LABEL.ORGANIC_WASTE).toBe('Organic Waste')
    expect(WASTE_CATEGORY_LABEL.PLASTIC_WASTE).toBe('Plastic Waste')
    expect(WASTE_CATEGORY_LABEL.PAPER_WASTE).toBe('Paper Waste')
  })

  it('shows the reporter column only for all-report readers', () => {
    const base = {
      onView: () => undefined,
      onEdit: () => undefined,
      onDelete: () => undefined,
      hasPermission: () => false,
      currentUserId: 1,
    }
    expect(getColumns({ ...base, showReporter: false }).map((c) => c.uid)).not.toContain(
      'reporter',
    )
    expect(getColumns({ ...base, showReporter: true }).map((c) => c.uid)).toContain(
      'reporter',
    )
  })
})
