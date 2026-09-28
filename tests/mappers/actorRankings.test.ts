import { getTopReceivers, getCombinedRankings, isReceiverOperation } from '../../src/mappers/actorRankings'

describe('Actor Rankings - Receiver', () => {
  const mockOps = [
    {
      op_source_account: 'A',
      op_source_amount: 100,
      op_destination_account: 'B',
      op_destination_amount: 50
    },
    {
      op_source_account: 'B',
      op_source_amount: 200,
      op_destination_account: 'C',
      op_destination_amount: 150
    },
    {
      op_source_account: 'C',
      op_source_amount: 50,
      op_destination_account: 'A',
      op_destination_amount: 25
    }
  ]

  it('should rank receivers by received volume', () => {
    const receivers = getTopReceivers(mockOps)
    expect(receivers[0].account).toBe('B')
    expect(receivers[0].score).toBe(50)
    expect(receivers[1].account).toBe('C')
  })

  it('should handle combined rankings', () => {
    const combined = getCombinedRankings(mockOps)
    expect(combined.length).toBe(3)
    expect(combined.some(r => r.account === 'A')).toBeTruthy()
  })

  it('should identify receiver operations', () => {
    expect(isReceiverOperation(mockOps[0])).toBe(true)
    expect(isReceiverOperation({ op_source_account: 'X' })).toBe(false)
  })

  it('should exclude operations without destination', () => {
    const opsWithoutDest = [...mockOps, { op_source_account: 'D', op_source_amount: 10 }]
    const receivers = getTopReceivers(opsWithoutDest)
    expect(receivers.length).toBe(3) // Only original 3 with destinations
  })
})