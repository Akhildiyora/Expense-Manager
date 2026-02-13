import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'

export type Budget = {
  id: string
  user_id: string
  category_id: string | null
  period: string
  amount: number
  start_date: string | null
  end_date: string | null
}

export const useBudgets = () => {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setBudgets([])
      return
    }

    const fetchBudgets = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('budgets')
        .select('*')
        .order('created_at', { ascending: false })
        console.log(data)

      if (err) {
        setError(err.message)
      } else {
        setBudgets(data as Budget[])
      }

      setLoading(false)
    }

    void fetchBudgets()

    const channel = supabase
      .channel('budgets_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets' },
        () => {
          void fetchBudgets()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  return { budgets, loading, error, setBudgets }
}

