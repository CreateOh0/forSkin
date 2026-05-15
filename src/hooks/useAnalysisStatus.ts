'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AnalysisStatus } from '@/lib/supabase/types'

interface AnalysisState {
  status: AnalysisStatus
}

export function useAnalysisStatus(analysisId: string): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ status: 'pending' })

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('analyses')
      .select('status')
      .eq('id', analysisId)
      .single()
      .then(({ data }) => {
        if (data?.status) {
          setState({ status: data.status as AnalysisStatus })
        }
      })

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
          const status = payload.new.status as AnalysisStatus
          setState({ status })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [analysisId])

  return state
}
