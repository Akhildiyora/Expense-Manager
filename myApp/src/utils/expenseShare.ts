import type { Expense } from '../queries/useExpenses'

// Calculate the current user's personal share for a given expense
// based on how we store rows in the expense_splits table.
export const getPersonalShare = (
  expense: Pick<Expense, 'amount' | 'payer_id' | 'expense_splits'>,
): number => {
  const total = Number(expense.amount ?? 0)
  const splits = expense.expense_splits ?? []

  // No splits recorded – if you paid, it's fully your expense; otherwise treat as 0.
  if (splits.length === 0) {
    return expense.payer_id ? 0 : total
  }

  // You paid (payer_id is null). Friends owe you their shares.
  // Your personal share is what's left after subtracting what others owe you.
  if (!expense.payer_id) {
    const totalOwedToYou = splits
      .filter((s) => s.friend_id && !s.owed_to_friend_id)
      .reduce((sum, s) => sum + Number(s.share_amount ?? 0), 0)

    const personal = total - totalOwedToYou
    return personal > 0 ? personal : 0
  }

  // A friend paid. If there's a row with friend_id === null and owed_to_friend_id === payer,
  // that row represents your share that you owe to the payer.
  const userRow = splits.find(
    (s) => s.friend_id === null && s.owed_to_friend_id === expense.payer_id,
  )

  if (!userRow) return 0

  const personal = Number(userRow.share_amount ?? 0)
  return personal > 0 ? personal : 0
}

