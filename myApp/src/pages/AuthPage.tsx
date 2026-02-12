import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../supabaseClient'

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [view, setView] = useState<'auth' | 'forgot-password' | 'verify-otp' | 'set-new-password'>('auth')
  const [loginMethod, setLoginMethod] = useState<'password' | 'phone-otp' | 'email-otp'>('password')
  
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [countryCode, setCountryCode] = useState('+91')
  const [isForgotPasswordFlow, setIsForgotPasswordFlow] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  
  // Timer state
  const [timer, setTimer] = useState(0)
  
  const navigate = useNavigate()
  const { signIn, signUp, signInWithGoogle, signInWithOtp, verifyOtp } = useAuth()

  const countryCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+7', country: 'Russia', flag: '🇷🇺' },
    // Add more as needed
  ]

  // Timer effect
  useEffect(() => {
    let interval: any
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  const startTimer = () => setTimer(60)

  // Reset state when switching modes
  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setView('auth')
    setError(null)
    setMessage(null)
    setTimer(0)
    setIsForgotPasswordFlow(false)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const result = await signInWithGoogle()
    setLoading(false)
    if (result.error) setError(result.error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (view === 'forgot-password') {
        // Send OTP for password reset (using login OTP mechanism)
        const target = loginMethod === 'phone-otp' ? `${countryCode}${phone}` : email
        const result = await signInWithOtp(target)
        
        if (result.error) {
          setError(result.error)
        } else {
          setMessage(`OTP sent to ${target}`)
          setView('verify-otp')
          startTimer()
          setIsForgotPasswordFlow(true)
        }
      } else if (view === 'verify-otp') {
        let target = email
        if ((mode === 'login' && loginMethod === 'phone-otp') || (isForgotPasswordFlow && loginMethod === 'phone-otp')) {
            target = `${countryCode}${phone}`
        }
        
        // For register verification, we might guess based on inputs, but typically we verify email via link.
        // If we are here in register mode, it's likely phone.
        if (mode === 'register') target = `${countryCode}${phone}`

        const result = await verifyOtp(target, otp)
        if (result.error) {
          setError(result.error)
        } else {
            if (isForgotPasswordFlow) {
                // Verified! Now set new password
                setView('set-new-password')
                setMessage(null)
            } else {
                navigate('/app')
            }
        }
      } else if (view === 'set-new-password') {
          const { error } = await supabase.auth.updateUser({ password: newPassword })
          if (error) {
              setError(error.message)
          } else {
              setMessage('Password updated successfully! Logging you in...')
              setTimeout(() => navigate('/app'), 1500)
          }
      } else {
        // Normal Auth (Login/Register)
        if (mode === 'register') {
             // Register: Email + Phone + Password
             // We use email/password for primary signup, and store phone in metadata
             const result = await signUp(email, password, firstName, lastName, `${countryCode}${phone}`)
             if (result.error) {
                 setError(result.error)
             } else {
                 setMessage('Registration successful! Please check your email/phone to verify.')
                 // Ideally we would also trigger phone verification here if supported
                 if (email.includes('test')) navigate('/app')
             }
        } else {
            // Login Mode
            if (loginMethod === 'phone-otp') {
                 const fullNumber = `${countryCode}${phone}`
                 const result = await signInWithOtp(fullNumber)
                 if (result.error) {
                     setError(result.error)
                 } else {
                     setMessage(`OTP sent to ${fullNumber}`)
                     setView('verify-otp')
                     startTimer()
                     setIsForgotPasswordFlow(false)
                 }
            } else if (loginMethod === 'email-otp') {
                 const result = await signInWithOtp(email)
                 if (result.error) {
                    setError(result.error)
                 } else {
                    setMessage(`OTP sent to ${email}`)
                    setView('verify-otp')
                    startTimer()
                    setIsForgotPasswordFlow(false)
                 }
            } else {
                // Email + Password
                const result = await signIn(email, password)
                if (result.error) setError(result.error)
                else navigate('/app')
            }
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 border border-slate-800 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Expense Tracker
        </h1>

        {view === 'auth' && (
            <div className="flex mb-6 rounded-full bg-slate-800 p-1">
            <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 text-sm rounded-full transition ${
                mode === 'login'
                    ? 'bg-slate-50 text-slate-900'
                    : 'text-slate-300'
                }`}
            >
                Login
            </button>
            <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex-1 py-2 text-sm rounded-full transition ${
                mode === 'register'
                    ? 'bg-slate-50 text-slate-900'
                    : 'text-slate-300'
                }`}
            >
                Register
            </button>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Login Methods Tabs */}
          {mode === 'login' && view === 'auth' && (
             <div className="flex justify-between gap-2 text-xs mb-4 border-b border-slate-800 pb-2">
                 <button type="button" onClick={() => setLoginMethod('password')} className={`pb-1 ${loginMethod === 'password' ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>Password</button>
                 <button type="button" onClick={() => setLoginMethod('phone-otp')} className={`pb-1 ${loginMethod === 'phone-otp' ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>Mobile OTP</button>
                 <button type="button" onClick={() => setLoginMethod('email-otp')} className={`pb-1 ${loginMethod === 'email-otp' ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>Email OTP</button>
             </div>
          )}

          {view === 'forgot-password' && (
              <div className="text-center mb-4">
                  <h3 className="text-lg font-medium">Reset Password</h3>
                  <p className="text-slate-400 text-sm mb-4">Select how you want to receive the OTP.</p>
                  
                   <div className="flex justify-center gap-4 text-sm mb-4">
                        <button type="button" onClick={() => setLoginMethod('email-otp')} className={`pb-1 border-b-2 ${loginMethod === 'email-otp' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>Email</button>
                        <button type="button" onClick={() => setLoginMethod('phone-otp')} className={`pb-1 border-b-2 ${loginMethod === 'phone-otp' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>Phone</button>
                    </div>
              </div>
          )}

          {view === 'verify-otp' && (
              <div className="text-center mb-4">
                  <h3 className="text-lg font-medium">Verify OTP</h3>
                  <p className="text-slate-400 text-sm">
                      Enter code sent to {loginMethod === 'phone-otp' ? `${countryCode} ${phone}` : email}
                  </p>
              </div>
          )}
          
          {view === 'set-new-password' && (
              <div className="text-center mb-4">
                  <h3 className="text-lg font-medium">Set New Password</h3>
                  <p className="text-slate-400 text-sm">Enter your new password below.</p>
              </div>
          )}

          {/* Name Fields (Register only) */}
          {mode === 'register' && view === 'auth' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" htmlFor="firstName">First Name</label>
                <input id="firstName" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-sm mb-1" htmlFor="lastName">Last Name</label>
                <input id="lastName" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
            </div>
          )}

          {/* Email Input - Register, or Login(Email), or ForgotPassword(Email) */}
          {((mode === 'register' || loginMethod === 'password' || loginMethod === 'email-otp') && view === 'auth') || (view === 'forgot-password' && loginMethod === 'email-otp') ? (
            <div>
                <label className="block text-sm mb-1" htmlFor="email">Email</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
          ) : null}

          {/* Phone Input - Register, or Login(Phone), or ForgotPassword(Phone) */}
          {((mode === 'register' || loginMethod === 'phone-otp') && view === 'auth') || (view === 'forgot-password' && loginMethod === 'phone-otp') ? (
            <div>
              <label className="block text-sm mb-1" htmlFor="phone">Phone Number</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-base text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none"
                  aria-label="Country Code"
                  style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"' }}
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code} className="text-base py-1">
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  required
                />
              </div>
            </div>
          ) : null}
          
          {/* Password Input - Register or Password Login */}
          {(mode === 'register' || loginMethod === 'password') && view === 'auth' && (
            <div>
                <label className="block text-sm mb-1" htmlFor="password">Password</label>
                <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
          )}

          {/* New Password Input */}
          {view === 'set-new-password' && (
            <div>
                <label className="block text-sm mb-1" htmlFor="newPassword">New Password</label>
                <input id="newPassword" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
          )}

          {/* OTP Input */}
          {view === 'verify-otp' && (
            <div>
                <label className="block text-sm mb-1" htmlFor="otp">One-Time Password</label>
                <input id="otp" type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400 text-center tracking-widest text-lg" />
                
                <div className="text-center mt-4">
                    {timer > 0 ? (
                        <p className="text-xs text-slate-400">Resend code in {timer}s</p>
                    ) : (
                        <button 
                            type="button" 
                            onClick={handleSubmit} // Re-triggers the login flow to send OTP
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                            Resend Code
                        </button>
                    )}
                </div>
            </div>
          )}
          
          {/* Actions */}
          {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">{error}</p>}
          {message && <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800 rounded-md px-3 py-2">{message}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 py-2 text-sm font-medium text-slate-950 transition">
            {loading ? 'Please wait...' : view === 'forgot-password' ? 'Send OTP' : view === 'verify-otp' ? 'Verify' : view === 'set-new-password' ? 'Update Password' : mode === 'login' ? 'Login' : 'Register'}
          </button>

          {/* Forgot Password Link - Only for Password Login */}
          {view === 'auth' && loginMethod === 'password' && mode === 'login' && (
              <button 
                type="button" 
                onClick={() => {
                    setView('forgot-password'); 
                    setIsForgotPasswordFlow(true); 
                    setLoginMethod('email-otp'); // Default to email for reset
                }} 
                className="w-full text-center text-xs text-slate-400 hover:text-emerald-400"
              >
                  Forgot Password?
              </button>
          )}

          {/* Back to Login */}
          {view !== 'auth' && (
              <button type="button" onClick={() => setView('auth')} className="w-full text-center text-xs text-slate-400 hover:text-emerald-400">
                  Back to Login
              </button>
          )}
        </form>
        
        {view === 'auth' && (
            <>
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or continue with</span></div>
                </div>
                <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-sm font-medium text-slate-200 transition border border-slate-700">
                    <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                </button>
            </>
        )}
      </div>
    </div>
  )
}

export default AuthPage

