export type RankingType = 'source' | 'receiver' | 'combined'

export interface AccountRanking {
  account: string
  score: number
  type: RankingType
  operations: number
}

export interface Operation {
  op_source_account: string
  op_source_amount: number
  op_destination_account?: string
  op_destination_amount?: number
  // ... other operation fields
}