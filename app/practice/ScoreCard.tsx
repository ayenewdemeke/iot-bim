type ScoreCardProps = {
  name: string
  score: number
  badge?: string
}

export function ScoreCard({ name, score, badge }: ScoreCardProps) {
  return (
    <div style={{ border: "1px solid #ccc", padding: 12, marginBottom: 8 }}>
      <p>User: {name}</p>
      <p>Score: {score}</p>

        {badge && <p>Badge: {badge}</p>}
    </div>
  )
}