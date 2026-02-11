import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'

export type Friend = {
  id: string
  user_id: string
  name: string
}

export const useFriends = () => {
  const { user } = useAuth()
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setFriends([])
      return
    }

    const fetchFriends = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('friends')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) {
        setError(err.message)
      } else {
        setFriends(data as Friend[])
      }

      setLoading(false)
    }

    void fetchFriends()
  }, [user])

  return { friends, loading, error, setFriends }
}

