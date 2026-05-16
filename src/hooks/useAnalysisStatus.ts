'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AnalysisStatus } from '@/lib/supabase/types'

interface AnalysisState {
  status: AnalysisStatus
}

const TERMINAL_STATUSES: AnalysisStatus[] = ['completed', 'failed']
const POLL_INTERVAL_MS = 3000

export function useAnalysisStatus(analysisId: string): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ status: 'pending' })
  const statusRef = useRef<AnalysisStatus>('pending')

  const updateStatus = (newStatus: AnalysisStatus) => {
    if (statusRef.current === newStatus) return
    statusRef.current = newStatus
    setState({ status: newStatus })
  }

  useEffect(() => {
    const supabase = createClient()

    const fetchStatus = async () => {
      const { data } = await supabase
        .from('analyses')
        .select('status')
        .eq('id', analysisId)
        .single()
      if (data?.status) updateStatus(data.status as AnalysisStatus)
    }

    fetchStatus()

    const channel = supabase
      .channel(`analysis:${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'analyses',
          filter: `id=eq.${analysisId}`,
        },
        (payload) => {
          updateStatus(payload.new.status as AnalysisStatus)
        }
      )
      .subscribe()

    const pollInterval = setInterval(() => {
      if (TERMINAL_STATUSES.includes(statusRef.current)) {
        clearInterval(pollInterval)
        return
      }
      fetchStatus()
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [analysisId])

  return state
}
