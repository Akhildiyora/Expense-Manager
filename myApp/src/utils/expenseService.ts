import { supabase } from '../supabaseClient'

export type ExpenseFormState = {
  id?: string
  amount: string
  currency: string
  date: string
  category_id: string
  title: string
  note: string
  is_recurring: boolean
  recurring_frequency?: string
  friendIds: string[]
  splitEvenly: boolean
  isSplit: boolean
  includeUser: boolean
  payerId: 'you' | string
  trip_id: string | null
  payment_mode: 'cash' | 'online' | 'card'
}

export const saveExpense = async (form: ExpenseFormState, userId: string) => {
  const payload = {
    amount: Number(form.amount),
    currency: form.currency,
    date: form.date,
    category_id: form.category_id || null,
    title: form.title,
    note: form.note || null,
    is_recurring: form.is_recurring,
    recurring_frequency: form.is_recurring ? form.recurring_frequency : null,
    payer_id: form.payerId === 'you' ? null : form.payerId,
    trip_id: form.trip_id || null,
    payment_mode: form.payment_mode || 'cash',
  }

  let expenseId = form.id

  if (form.id) {
    const { data, error: updateError } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', form.id)
      .select()
      .single()

    if (updateError) throw updateError
    expenseId = data.id
  } else {
    const { data, error: insertError } = await supabase
      .from('expenses')
      .insert({ ...payload, user_id: userId })
      .select()
      .single()

    if (insertError) throw insertError
    expenseId = data.id
  }

  if (!expenseId) {
    throw new Error('Missing expense id after save')
  }

  // Handle splits
  await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
  
  if (form.isSplit && (form.friendIds.length > 0 || form.includeUser)) {
    const amountNumber = Number(form.amount)
    if (amountNumber > 0) {
      const participantCount = form.friendIds.length + (form.includeUser ? 1 : 0)
      if (participantCount > 0) {
        const perShare = amountNumber / participantCount

        let rows: { expense_id: string; friend_id: string | null; owed_to_friend_id: string | null; share_amount: number }[] = []

        if (form.payerId === 'you') {
          // You paid.
          rows = form.friendIds.map((friendId) => ({
            expense_id: expenseId!,
            friend_id: friendId,
            owed_to_friend_id: null, // owed to user
            share_amount: perShare,
          }))
        } else {
          // A friend paid.
          const otherParticipants = form.friendIds.filter(id => id !== form.payerId)
          
          const friendRows: typeof rows = otherParticipants.map((friendId) => ({
            expense_id: expenseId!,
            friend_id: friendId,
            owed_to_friend_id: form.payerId,
            share_amount: perShare,
          }))

          // User owes payer if user is included
          if (form.includeUser) {
            friendRows.push({
              expense_id: expenseId!,
              friend_id: null as (string | null), // user
              owed_to_friend_id: form.payerId,
              share_amount: perShare,
            })
          }
          
          rows = friendRows
        }

        if (rows.length > 0) {
          const { error: splitError } = await supabase
            .from('expense_splits')
            .insert(rows)

          if (splitError) throw splitError
        }
      }
    }
  }

  return expenseId
}
