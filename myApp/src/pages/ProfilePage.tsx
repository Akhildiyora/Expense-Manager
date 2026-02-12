import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'

const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (user) {
      setFirstName(user.user_metadata?.first_name || '')
      setLastName(user.user_metadata?.last_name || '')
      setEmail(user.email || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (password && password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const updates: any = {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      }

      if (email !== user?.email) updates.email = email
      if (phone !== user?.phone) updates.phone = phone
      if (password) updates.password = password

      const { data, error } = await supabase.auth.updateUser(updates)

      if (error) throw error

      let msg = 'Profile updated successfully!'
      if (updates.email && data.user?.email !== email) {
        msg += ' Please check your new email for a verification link.'
      }
      if (updates.phone && data.user?.phone !== phone) {
        msg += ' Please check your phone for a verification code.'
      }

      setMessage({ type: 'success', text: msg })
      
      // Clear password fields after success
      if (password) {
        setPassword('')
        setConfirmPassword('')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="pt-14 md:pt-0">
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="text-sm text-slate-400">
          Manage your account settings, contact info, and security.
        </p>
      </header>
      
      {message && (
        <div
            className={`p-3 rounded-xl text-sm border ${
            message.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400'
                : 'bg-red-950/30 border-red-800 text-red-400'
            }`}
        >
            {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
          {/* General Info Section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 h-fit">
            <h3 className="text-lg font-medium mb-4 text-slate-200">Personal Information</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="block text-sm mb-1 text-slate-400">First Name</label>
                <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                </div>
                <div>
                <label className="block text-sm mb-1 text-slate-400">Last Name</label>
                <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                </div>
            </div>

            <div>
                <label className="block text-sm mb-1 text-slate-400">Email Address</label>
                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <p className="mt-1 text-[10px] text-slate-500">Changing text triggers verification.</p>
            </div>

            <div>
                <label className="block text-sm mb-1 text-slate-400">Phone Number</label>
                <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
            </div>
            
            <div className="pt-2">
                <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-medium disabled:opacity-60 transition-colors"
                >
                {loading ? 'Saving...' : 'Update Details'}
                </button>
            </div>
            </form>
          </section>

          {/* Security Section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 h-fit">
            <h3 className="text-lg font-medium mb-4 text-slate-200">Security</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                <label className="block text-sm mb-1 text-slate-400">New Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                </div>
                <div>
                <label className="block text-sm mb-1 text-slate-400">Confirm Password</label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                </div>
                
                <div className="pt-2">
                    <button
                    type="submit"
                    disabled={loading || !password}
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-medium disabled:opacity-60 transition-colors"
                    >
                    Change Password
                    </button>
                </div>
            </form>
          </section>
      </div>
    </div>
  )
}

export default ProfilePage
