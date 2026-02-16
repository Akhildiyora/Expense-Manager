import React, { useState } from 'react'
import { supabase } from '../../supabaseClient'

interface MemberPermissionsDialogProps {
  isOpen: boolean
  onClose: () => void
  member: {
    id: string
    user_id: string | null
    email: string | null
    role: string
    can_add_expenses?: boolean
    friends?: { name: string } | null
  }
  currentUserRole: string
  onUpdate: () => void
}

export const MemberPermissionsDialog: React.FC<MemberPermissionsDialogProps> = ({
  isOpen,
  onClose,
  member,
  currentUserRole,
  onUpdate
}) => {
  const [role, setRole] = useState(member.role)
  const [canAddExpenses, setCanAddExpenses] = useState(member.can_add_expenses || false)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const memberName = member.friends?.name || member.email || 'Unknown'
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  const handleSave = async () => {
    if (!canManage) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('trip_members')
        .update({ 
          role,
          can_add_expenses: canAddExpenses
        })
        .eq('id', member.id)
      
      if (error) throw error
      
      onUpdate()
      onClose()
    } catch (err: any) {
      alert('Failed to update permissions: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-100 mb-4">Manage Permissions</h3>
        
        <div className="space-y-4">
          {/* Member Info */}
          <div className="bg-slate-800/50 p-3 rounded-lg">
            <p className="text-sm font-medium text-slate-200">{memberName}</p>
            <p className="text-xs text-slate-500">{member.email}</p>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor">Editor (Can add expenses)</option>
              <option value="admin">Admin (Full management)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              {role === 'admin' && 'Can manage members and all expenses'}
              {role === 'editor' && 'Can add new expenses'}
              {role === 'viewer' && 'Can only view trip details'}
            </p>
          </div>

          {/* Custom Permission: Can Add Expenses */}
          {role === 'viewer' && (
            <div className="bg-sky-950/20 border border-sky-900/30 rounded-xl p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-slate-200">Can Add Expenses</p>
                  <p className="text-xs text-slate-500 mt-0.5">Grant permission to add expenses despite viewer role</p>
                </div>
                <input
                  type="checkbox"
                  checked={canAddExpenses}
                  onChange={e => setCanAddExpenses(e.target.checked)}
                  disabled={!canManage}
                  className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-sky-500 focus:ring-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800">
            <button 
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-slate-400 hover:bg-slate-800 transition text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canManage || loading}
              className="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
