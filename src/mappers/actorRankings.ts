import { Operation, AccountRanking } from '../types'
import { getTopAccounts } from './baseRankings'

/**
 * Returns top accounts by received volume (post-P0 destination fields)
 * @param ops - Filtered operation set
 * @param limit - Top N accounts
 */
export const getTopReceivers = (
  ops: Operation[],
  limit: number = 10
): AccountRanking[] => {
  const receiverMap = new Map<string, number>()

  ops.forEach(op => {
    if (op.op_destination_account && op.op_destination_amount) {
      const key = op.op_destination_account.toLowerCase()
      receiverMap.set(key, (receiverMap.get(key) || 0) + op.op_destination_amount)
    }
  })

  return getTopAccounts(Array.from(receiverMap.entries()), limit, 'received')
}

/**
 * Returns combined source+receiver rankings
 */
export const getCombinedRankings = (
  ops: Operation[],
  limit: number = 10
): AccountRanking[] => {
  const sourceRankings = getTopAccounts(
    ops.map(op => [op.op_source_account, op.op_source_amount]),
    limit
  )
  const receiverRankings = getTopReceivers(ops, limit)

  // Merge and deduplicate
  const combined = [...sourceRankings, ...receiverRankings]
  return Array.from(new Map(combined.map(r => [r.account, r])).values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Determines if operation should be included in receiver rankings
 */
export const isReceiverOperation = (op: Operation): boolean => {
  return !!op.op_destination_account && !!op.op_destination_amount
}