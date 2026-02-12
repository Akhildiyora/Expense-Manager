import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'

export type Expense = {
  id: string
  user_id: string
  amount: number
  currency: string
  category_id: string | null
  title: string
  date: string
  note: string | null
  is_recurring: boolean
  payer_id: string | null
  trip_id: string | null
  payment_mode: 'cash' | 'online' | 'card' | null
  expense_splits: {
    friend_id: string | null
    owed_to_friend_id: string | null
    share_amount: number
    friends?: { linked_user_id: string | null } | null
  }[]
}

type ExpenseFilters = {
  fromDate?: string
  toDate?: string
  categoryId?: string
  excludeTrips?: boolean
  tripId?: string
  paymentMode?: 'cash' | 'online' | 'card'
  search?: string
  sortBy?: 'date' | 'amount' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}

export const useExpenses = (filters: ExpenseFilters = {}) => {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setExpenses([])
      return
    }

    const fetchExpenses = async () => {
      setLoading(true)
      setError(null)
      let query = supabase
        .from('expenses')
        .select('*, expense_splits(*, friends(linked_user_id))')

      // Apply Filters
      if (filters.fromDate) {
        query = query.gte('date', filters.fromDate)
      }
      if (filters.toDate) {
        query = query.lte('date', filters.toDate)
      }
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }
      if (filters.excludeTrips) {
        query = query.is('trip_id', null)
      }
      if (filters.tripId) {
        query = query.eq('trip_id', filters.tripId)
      }
      if (filters.paymentMode) {
        query = query.eq('payment_mode', filters.paymentMode)
      }
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`)
      }

      // Apply Sorting
      const sortField = filters.sortBy || 'date'
      const sortOrder = filters.sortOrder === 'asc'

      // Primary sort
      query = query.order(sortField, { ascending: sortOrder })
      
      // Secondary sort (always consistent tie-breaker)
      if (sortField !== 'created_at') {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error: err } = await query
      if (err) {
        setError(err.message)
      } else {
        setExpenses(data as Expense[])
      }
      setLoading(false)
    }

    void fetchExpenses()

    const subscription = supabase
      .channel('public:expenses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          void fetchExpenses()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(subscription)
    }
  }, [
    user, 
    filters.fromDate, 
    filters.toDate, 
    filters.categoryId, 
    filters.excludeTrips, 
    filters.tripId, 
    filters.paymentMode, 
    filters.search, 
    filters.sortBy, 
    filters.sortOrder
  ])

  return { expenses, loading, error, setExpenses }
}

