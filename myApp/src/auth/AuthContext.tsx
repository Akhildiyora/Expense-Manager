import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<{ error?: string }>
  signInWithOtp: (emailOrPhone: string) => Promise<{ error?: string }>
  verifyOtp: (emailOrPhone: string, token: string) => Promise<{ error?: string }>
  resetPassword: (email: string) => Promise<{ error?: string }>
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    }

    void init()

    const INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

    const checkToken = async () => {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession()
      
      if (error || !currentSession) {
        console.log(`[Auth Check ${new Date().toLocaleTimeString()}] No active session or error.`)
        return
      }

      const expiresAt = currentSession.expires_at 
        ? new Date(currentSession.expires_at * 1000) 
        : null
      
      if (expiresAt) {
        const now = new Date()
        const timeRemainingMs = expiresAt.getTime() - now.getTime()
        const minutesRemaining = Math.floor(timeRemainingMs / 60000)
        const secondsRemaining = Math.floor((timeRemainingMs % 60000) / 1000)
        
        console.log(
          `[Auth Check ${new Date().toLocaleTimeString()}] Token is VALID.\n` +
          `Expires at: ${expiresAt.toLocaleTimeString()}\n` +
          `Time remaining: ${minutesRemaining}m ${secondsRemaining}s`
        )
      } else {
        console.log(`[Auth Check ${new Date().toLocaleTimeString()}] Token VALID (No expiration time found).`)
      }
    }

    // Initial check
    void checkToken()

    const intervalId = setInterval(() => {
        void checkToken()
    }, INTERVAL_MS)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => {
      isMounted = false
      clearInterval(intervalId)
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      return { error: error.message }
    }
    return {}
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/app',
      },
    })
    if (error) {
      return { error: error.message }
    }
    return {}
  }

  const signInWithOtp = async (emailOrPhone: string) => {
    // Determine if email or phone
    const isEmail = emailOrPhone.includes('@')
    
    let result
    if (isEmail) {
      result = await supabase.auth.signInWithOtp({
        email: emailOrPhone,
      })
    } else {
      result = await supabase.auth.signInWithOtp({
        phone: emailOrPhone,
      })
    }
    
    if (result.error) {
      return { error: result.error.message }
    }
    return {}
  }

  const verifyOtp = async (emailOrPhone: string, token: string) => {
     const isEmail = emailOrPhone.includes('@')
     let result
     if (isEmail) {
        result = await supabase.auth.verifyOtp({
            email: emailOrPhone,
            token,
            type: 'email',
        })
     } else {
        result = await supabase.auth.verifyOtp({
            phone: emailOrPhone,
            token,
            type: 'sms',
        })
     }

     if (result.error) {
        return { error: result.error.message }
     }
     return {}
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/update-password',
    })
    if (error) {
      return { error: error.message }
    }
    return {}
  }

  const signUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          phone: phone,
        },
      },
    })
    if (error) {
      return { error: error.message }
    }
    return {}
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signIn,
    signInWithGoogle,
    signInWithOtp,
    verifyOtp,
    resetPassword,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

