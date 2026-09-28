import { useQuery } from 'react-query'
import { getTopAccounts, getTopReceivers, getCombinedRankings } from '../mappers/actorRankings'
import { RankingType } from '../types'

export const useActorRankings = (type: RankingType) => {
  return useQuery(['actorRankings', type], () => {
    switch (type) {
      case 'source':
        return getTopAccounts(
          operations.map(op => [op.op_source_account, op.op_source_amount]),
          20
        )
      case 'receiver':
        return getTopReceivers(operations, 20)
      case 'combined':
        return getCombinedRankings(operations, 20)
      default:
        throw new Error('Invalid ranking type')
    }
  })
}