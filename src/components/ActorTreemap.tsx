import React, { useState } from 'react'
import { useActorRankings } from '../hooks/useActorRankings'
import { RankingType } from '../types'

const ActorTreemap: React.FC = () => {
  const [rankingType, setRankingType] = useState<RankingType>('source')
  const { rankings, isLoading } = useActorRankings(rankingType)

  if (isLoading) return <div>Loading rankings...</div>

  return (
    <div className="actor-treemap">
      <div className="ranking-toggle">
        <button
          className={rankingType === 'source' ? 'active' : ''}
          onClick={() => setRankingType('source')}
        >
          Source Activity
        </button>
        <button
          className={rankingType === 'receiver' ? 'active' : ''}
          onClick={() => setRankingType('receiver')}
        >
          Receiver Activity
        </button>
        <button
          className={rankingType === 'combined' ? 'active' : ''}
          onClick={() => setRankingType('combined')}
        >
          Combined
        </button>
      </div>
      <TreemapVisualization data={rankings} />
    </div>
  )
}

export default ActorTreemap