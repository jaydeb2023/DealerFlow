'use client'
import { createContext, useContext } from 'react'
import type { DfRole } from '@/lib/df/constants'

export interface StaffMe { id: string; email: string; full_name: string | null; role: DfRole; dealer_id: string | null }
export interface OrgMe { id: string; name: string; slug: string; status: 'trial' | 'active' | 'suspended'; plan: string | null; trial_ends_at: string | null }
export const StaffContext = createContext<StaffMe | null>(null)
export const OrgContext = createContext<OrgMe | null>(null)
export function useStaff(): StaffMe {
  const s = useContext(StaffContext)
  if (!s) throw new Error('useStaff outside the app shell')
  return s
}
export const useOrg = () => useContext(OrgContext)
