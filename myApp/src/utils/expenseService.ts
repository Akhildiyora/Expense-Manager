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
  is_settlement?: boolean
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
    is_settlement: form.is_settlement || false,
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

          // Send Notifications
          // 1. Get registered_user_id for all friends involved
          const friendIdsUnique = [...new Set(form.friendIds)]
          if (friendIdsUnique.length > 0) {
              const { data: friendsData } = await supabase
                .from('friends')
                .select('id, name, registered_user_id')
                .in('id', friendIdsUnique)
              
              if (friendsData) {
                  // Create notification records
                  const notifications = []
                  
                  for (const row of rows) {
                      // We only notify if there is a friend involved who needs to pay or receive
                      // Case 1: You paid, Friend owes you. (row.friend_id is friend, row.owed_to is null)
                      if (row.friend_id && !row.owed_to_friend_id) {
                          const friend = friendsData.find(f => f.id === row.friend_id)
                          if (friend?.registered_user_id) {
                              notifications.push({
                                  user_id: friend.registered_user_id,
                                  title: 'New Expense Split',
                                  message: `You owe ${Number(row.share_amount).toFixed(2)} for ${form.title}`,
                                  type: 'expense',
                                  trip_id: form.trip_id || null, // Ensure trip_id is set
                                  metadata: { expense_id: expenseId, amount: row.share_amount }
                              })
                          }
                      }
                      
                      // Case 2: Friend paid. You owe Friend. (row.friend_id is null/user, row.owed_to is friend)
                      // We don't notify ourselves.
                      
                      // Case 3: Friend A paid, Friend B owes. (row.friend_id is B, row.owed_to is A)
                      if (row.friend_id && row.owed_to_friend_id) {
                          const debtor = friendsData.find(f => f.id === row.friend_id)
                          const creditor = friendsData.find(f => f.id === row.owed_to_friend_id)
                          
                          if (debtor?.registered_user_id) {
                              notifications.push({
                                  user_id: debtor.registered_user_id,
                                  title: 'New Expense Split',
                                  message: `You owe ${creditor?.name || 'someone'} ${Number(row.share_amount).toFixed(2)} for ${form.title}`,
                                  type: 'expense',
                                  trip_id: form.trip_id || null,
                                  metadata: { expense_id: expenseId, amount: row.share_amount }
                              })
                          }
                      }
                  }

                  if (notifications.length > 0) {
                      await supabase.from('notifications').insert(notifications)
                  }
              }
          }
        }
      }
    }
  }

  return expenseId
}
