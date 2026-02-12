import type { Expense } from '../queries/useExpenses'

// Calculate the current user's personal share for a given expense
// based on how we store rows in the expense_splits table.
export const getPersonalShare = (
  expense: Pick<Expense, 'user_id' | 'amount' | 'payer_id' | 'expense_splits'> & { expense_splits?: any[] },
  viewerId?: string
): number => {
  const total = Number(expense.amount ?? 0)
  const splits = expense.expense_splits ?? []

  // No splits recorded – if you paid (or are the owner and paid), it's fully your expense.
  if (splits.length === 0) {
    // If viewer is the owner
    if (viewerId === expense.user_id) {
        return expense.payer_id ? 0 : total
    }
    // If viewer is NOT the owner, they have 0 share unless splits exist
    return 0
  }

  // --- CASE 1: Viewer is the Owner (Standard Logic) ---
  if (viewerId === expense.user_id) {
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
      return Number(userRow.share_amount ?? 0)
  }

  // --- CASE 2: Viewer is a Linked Friend (Shared View) ---
  // We need to find the split that belongs to 'viewerId'.
  // This requires looking at the 'friends' relation joined in the split.
  
  if (!viewerId) return 0 // Can't determine share without ID

  // Find the split where the friend record links to the viewer
  const mySplit = splits.find(s => s.friends?.linked_user_id === viewerId)
  
  if (mySplit) {
      return Number(mySplit.share_amount ?? 0)
  }

  return 0
}

