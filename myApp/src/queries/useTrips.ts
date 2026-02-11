import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'

export type Trip = {
  id: string
  user_id: string
  name: string
  budget: number | null
  start_date: string | null
  end_date: string | null
  currency: string
  created_at: string
  member_count?: number
  spent?: number
}

export const useTrips = () => {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setTrips([])
      return
    }

    const fetchTrips = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch trips with a count of members and sum of expenses
        const { data: tripData, error: err } = await supabase
          .from('trips')
          .select(`
            *,
            trip_members(count),
            expenses(amount)
          `)
          .order('created_at', { ascending: false })

        if (err) throw err

        const processedTrips = (tripData || []).map(t => ({
          ...t,
          member_count: (t as any).trip_members?.[0]?.count ?? 0,
          spent: (t as any).expenses?.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0) ?? 0
        })) as Trip[]

        setTrips(processedTrips)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setLoading(false)
      }
    }

    void fetchTrips()
  }, [user])

  return { trips, loading, error, setTrips }
}
