import React, { useState } from 'react'
import { useTrips, type Trip } from '../queries/useTrips'
import { useFriends } from '../queries/useFriends'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'
import { Link } from 'react-router-dom'
import {
  MapIcon,
  PlusIcon,
  CalendarIcon,
  UserGroupIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

const TripsPage: React.FC = () => {
  const { trips, loading, setTrips } = useTrips()
  const { friends } = useFriends()
  const { user } = useAuth()
  
  const [formOpen, setFormOpen] = useState(false)
  const [editingTripId, setEditingTripId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    budget: '',
    startDate: '',
    endDate: '',
    memberIds: [] as string[]
  })

  const resetForm = () => {
    setForm({ name: '', budget: '', startDate: '', endDate: '', memberIds: [] })
    setEditingTripId(null)
    setFormOpen(false)
  }

  const startEdit = (trip: any) => {
    // We need to fetch the existing member IDs for this trip
    const fetchMemberIds = async () => {
        const { data } = await supabase.from('trip_members').select('friend_id').eq('trip_id', trip.id)
        setForm({
            name: trip.name,
            budget: trip.budget ? String(trip.budget) : '',
            startDate: trip.start_date || '',
            endDate: trip.end_date || '',
            memberIds: data?.map(m => m.friend_id) || []
        })
        setEditingTripId(trip.id)
        setFormOpen(true)
    }
    void fetchMemberIds()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name) return
    setSaving(true)

    try {
      const tripPayload = {
        user_id: user.id,
        name: form.name,
        budget: form.budget ? Number(form.budget) : null,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
      }

      let tripId = editingTripId

      if (editingTripId) {
        const { error: tripErr } = await supabase
          .from('trips')
          .update(tripPayload)
          .eq('id', editingTripId)
        if (tripErr) throw tripErr

        // Smart Update Members (Preserve roles/user_ids)
        // 1. Fetch current members
        const { data: currentMembers } = await supabase
            .from('trip_members')
            .select('friend_id')
            .eq('trip_id', editingTripId)
        
        const currentMemberIds = currentMembers?.map(m => m.friend_id) || []
        const newMemberIds = form.memberIds

        // 2. Determine Additions and Removals
        const toAdd = newMemberIds.filter(id => !currentMemberIds.includes(id))
        const toRemove = currentMemberIds.filter(id => !newMemberIds.includes(id))

        // 3. Execute Updates
        if (toRemove.length > 0) {
            await supabase
                .from('trip_members')
                .delete()
                .eq('trip_id', editingTripId)
                .in('friend_id', toRemove)
        }

        if (toAdd.length > 0) {
            const memberRows = toAdd.map(friendId => ({
                trip_id: editingTripId,
                friend_id: friendId
            }))
            await supabase.from('trip_members').insert(memberRows)
        }

      } else {
        const { data: trip, error: tripErr } = await supabase
          .from('trips')
          .insert(tripPayload)
          .select()
          .single()
        if (tripErr) throw tripErr
        tripId = trip.id

        if (form.memberIds.length > 0 && tripId) {
            const memberRows = form.memberIds.map(friendId => ({
              trip_id: tripId,
              friend_id: friendId
            }))
            const { error: memErr } = await supabase.from('trip_members').insert(memberRows)
            if (memErr) throw memErr
        }
      }

      // Refresh trips
      const { data: refreshed } = await supabase
        .from('trips')
        .select(`*, trip_members(count), expenses(amount)`)
        .order('created_at', { ascending: false })
      
      const processed = (refreshed || []).map(t => ({
        ...t,
        member_count: (t as any).trip_members?.[0]?.count ?? 0,
        spent: (t as any).expenses?.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0) ?? 0
      })) as Trip[]
      
      setTrips(processed)
      resetForm()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save trip'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this trip? All related data will be lost.')) return
    setDeletingId(id)
    try {
        const { error } = await supabase.from('trips').delete().eq('id', id)
        if (error) throw error
        setTrips(trips.filter(t => t.id !== id))
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete trip'
        alert(message)
    } finally {
        setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-14 md:pt-0">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-sky-400" />
            Trips
          </h2>
          <p className="text-sm text-slate-400">Plan and track expenses for your journeys.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-sky-900/20"
        >
          <PlusIcon className="w-4 h-4" />
          Plan Trip
        </button>
      </header>

      {loading && <div className="text-center text-slate-500 py-10">Loading trips...</div>}
      
      {!loading && trips.length === 0 && (
        <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-slate-800/50 border-dashed">
          <MapIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-base">No trips planned yet.</p>
          <button onClick={() => setFormOpen(true)} className="mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium">
            Start planning your first trip
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip) => (
          <div
            key={trip.id}
            className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 transition group"
          >
            <div className="flex justify-between items-start mb-4">
              <Link to={`/app/trips/${trip.id}`} className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-200 group-hover:text-sky-400 transition truncate">{trip.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1 shrink-0"><CalendarIcon className="w-3.5 h-3.5" /> {trip.start_date || 'N/A'}</span>
                  <span className="shrink-0">•</span>
                  <span className="flex items-center gap-1 shrink-0"><UserGroupIcon className="w-3.5 h-3.5" /> {((trip as any).member_count || 0) + 1} Members</span>
                </div>
              </Link>
              <div className="flex gap-2 shrink-0 ml-4">
                 <button 
                   onClick={(e) => {
                     e.preventDefault()
                     e.stopPropagation()
                     startEdit(trip)
                   }}
                   className="p-2 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-950/30 transition shadow-sm"
                   title="Edit Trip"
                 >
                    <PencilSquareIcon className="w-4 h-4" />
                 </button>
                 <button 
                   onClick={(e) => {
                     e.preventDefault()
                     e.stopPropagation()
                     handleDelete(trip.id)
                   }}
                   className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition shadow-sm"
                   disabled={deletingId === trip.id}
                   title="Delete Trip"
                 >
                    <TrashIcon className="w-4 h-4" />
                 </button>
              </div>
            </div>
            
            {trip.budget && (
              <div className="space-y-2 mt-auto pt-4 border-t border-slate-800/50">
                 <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Budget Progress</span>
                    <span className={(trip as any).spent > Number(trip.budget) ? 'text-red-400' : 'text-sky-400'}>
                      ₹{((trip as any).spent || 0).toLocaleString()} / ₹{Number(trip.budget).toLocaleString()}
                    </span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        (trip as any).spent > Number(trip.budget) ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]'
                      }`}
                      style={{ width: `${Math.min(100, ((trip as any).spent / Number(trip.budget)) * 100)}%` }}
                    ></div>
                 </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center text-slate-100">
               <h3 className="text-lg font-semibold">{editingTripId ? 'Edit Trip' : 'New Trip'}</h3>
               <button onClick={resetForm} className="text-slate-400 hover:text-slate-200 transition text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Trip Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 outline-none focus:border-sky-500 transition"
                    placeholder="e.g. Goa Trip 2024"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Start Date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 text-sm [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">End Date</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 text-sm [color-scheme:dark]"
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Budget (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      value={form.budget}
                      onChange={(e) => setForm(f => ({ ...f, budget: e.target.value }))}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-8 pr-4 py-2 text-slate-200 outline-none focus:border-sky-500 transition"
                      placeholder="0.00"
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Members</label>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {friends.map(friend => (
                      <label key={friend.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-800 transition">
                        <input
                          type="checkbox"
                          checked={form.memberIds.includes(friend.id)}
                          onChange={(e) => {
                            if (e.target.checked) setForm(f => ({ ...f, memberIds: [...f.memberIds, friend.id] }))
                            else setForm(f => ({ ...f, memberIds: f.memberIds.filter(id => id !== friend.id) }))
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-sky-500/50"
                        />
                        <span className="text-sm text-slate-300">{friend.name}</span>
                      </label>
                    ))}
                    {friends.length === 0 && <p className="text-xs text-slate-500">No friends found. Add them in the Friends page first.</p>}
                  </div>
               </div>
               <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-sky-900/20 transition disabled:opacity-50"
                >
                  {saving ? (editingTripId ? 'Updating...' : 'Creating...') : (editingTripId ? 'Update Trip' : 'Create Trip')}
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripsPage
