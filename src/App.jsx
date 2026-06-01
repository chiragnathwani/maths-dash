import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const GAME_DURATION = 60
const TABLES = [1,2,3,4,5,6,7,8,9,10,11,12]

const MODES = [
  { id: 'times', label: 'Times Tables', icon: '✖️', desc: '6 × 7 = ?' },
  { id: 'division', label: 'Division', icon: '➗', desc: '42 ÷ 7 = ?' },
  { id: 'missing', label: 'Missing Number', icon: '❓', desc: '6 × ? = 42' },
  { id: 'mixed', label: 'Mixed', icon: '🔀', desc: 'All types!' },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateQuestion(table, mode) {
  const multiplier = Math.floor(Math.random() * 12) + 1
  const a = table
  const b = multiplier
  const product = a * b

  let actualMode = mode
  if (mode === 'mixed') {
    actualMode = ['times', 'division', 'missing'][Math.floor(Math.random() * 3)]
  }

  if (actualMode === 'times') {
    const [x, y] = Math.random() > 0.5 ? [a, b] : [b, a]
    return { text: `${x} × ${y} = ?`, answer: product }
  } else if (actualMode === 'division') {
    return { text: `${product} ÷ ${a} = ?`, answer: b }
  } else {
    const [x, y] = Math.random() > 0.5 ? [a, b] : [b, a]
    return { text: `${x} × ? = ${product}`, answer: y }
  }
}

function generateOptions(answer) {
  const options = new Set([answer])
  const nearby = [answer - 2, answer - 1, answer + 1, answer + 2,
    answer - 3, answer + 3, answer * 2, Math.max(1, answer - 4)]
  const shuffled = shuffle(nearby)
  for (const n of shuffled) {
    if (n > 0 && n !== answer) options.add(n)
    if (options.size === 4) break
  }
  while (options.size < 4) {
    const n = Math.floor(Math.random() * 120) + 1
    options.add(n)
  }
  return shuffle([...options])
}

function getRating(score) {
  if (score >= 20) return { emoji: '🏆', title: 'Times Table Champion!', msg: 'Absolutely brilliant!' }
  if (score >= 15) return { emoji: '⭐', title: 'Super Star!', msg: 'Amazing work!' }
  if (score >= 10) return { emoji: '😊', title: 'Great Job!', msg: "You're getting really good!" }
  if (score >= 5)  return { emoji: '👍', title: 'Good Effort!', msg: 'Keep practising!' }
  return { emoji: '💪', title: 'Keep Going!', msg: 'Practice makes perfect!' }
}

function HomeScreen({ onStart }) {
  const [selectedTables, setSelectedTables] = useState(new Set())
  const [selectedMode, setSelectedMode] = useState('times')

  const toggleTable = (t) => {
    setSelectedTables(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  const selectAll = () => setSelectedTables(new Set(TABLES))
  const clearAll = () => setSelectedTables(new Set())

  const hasSelection = selectedTables.size > 0

  return (
    <div className="screen">
      <img src="/logo.png" alt="Maths Dash logo" className="logo-img" />
      <h1 className="home-title">Maths Dash!</h1>
      <p className="home-subtitle">Fast-fire maths practice for kids</p>

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <p className="section-label" style={{margin:0}}>Choose your times tables</p>
        <div style={{display:'flex', gap:8}}>
          <button className="tiny-btn" onClick={selectAll}>All</button>
          <button className="tiny-btn" onClick={clearAll}>Clear</button>
        </div>
      </div>
      <div className="table-grid">
        {TABLES.map(t => (
          <button
            key={t}
            className={`table-btn${selectedTables.has(t) ? ' selected' : ''}`}
            onClick={() => toggleTable(t)}
          >
            {t}×
          </button>
        ))}
      </div>

      <p className="section-label">Choose a game type</p>
      <div className="mode-grid">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`mode-btn${selectedMode === m.id ? ' selected' : ''}`}
            onClick={() => setSelectedMode(m.id)}
          >
            <span className="mode-icon">{m.icon}</span>
            {m.label}
            <br /><small style={{fontWeight:400, opacity:0.8}}>{m.desc}</small>
          </button>
        ))}
      </div>

      <button
        className="start-btn"
        disabled={!hasSelection}
        onClick={() => onStart([...selectedTables], selectedMode)}
      >
        ▶ Start!
      </button>
      {!hasSelection && (
        <p style={{marginTop:12, color:'#9ca3af', fontSize:'0.9rem'}}>
          Pick at least one times table to begin
        </p>
      )}
    </div>
  )
}

function GameScreen({ table, mode, onEnd }) {
  const [question, setQuestion] = useState(null)
  const [options, setOptions] = useState([])
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [feedback, setFeedback] = useState(null)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const streakRef = useRef(0)
  const lockedRef = useRef(false)
  const endedRef = useRef(false)

  const nextQuestion = useCallback(() => {
    const resolvedTable = table[Math.floor(Math.random() * table.length)]
    const q = generateQuestion(resolvedTable, mode)
    setQuestion(q)
    setOptions(generateOptions(q.answer))
    setFeedback(null)
    lockedRef.current = false
  }, [table, mode])

  useEffect(() => { nextQuestion() }, [nextQuestion])

  useEffect(() => {
    if (timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [timeLeft])

  useEffect(() => {
    if (timeLeft === 0 && !endedRef.current) {
      endedRef.current = true
      onEnd({ score, wrong, bestStreak: Math.max(bestStreak, streakRef.current) })
    }
  })

  const handleAnswer = (val, idx) => {
    if (lockedRef.current || timeLeft === 0) return
    lockedRef.current = true
    const correct = val === question.answer

    setFeedback({ idx, correct })

    if (correct) {
      streakRef.current += 1
      setStreak(streakRef.current)
      setBestStreak(prev => Math.max(prev, streakRef.current))
      setScore(sc => sc + 1)
    } else {
      streakRef.current = 0
      setStreak(0)
      setWrong(w => w + 1)
    }

    setTimeout(() => nextQuestion(), 380)
  }

  if (!question) return null

  const progress = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="screen">
      <div className="game-header">
        <div className="stat-box score-box">
          <div className="stat-label">Score</div>
          <div className="stat-value">{score}</div>
        </div>
        <div className={`stat-box timer-box${timeLeft <= 10 ? ' danger' : ''}`}>
          <div className="stat-label">Time</div>
          <div className="stat-value">{timeLeft}s</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Wrong</div>
          <div className="stat-value" style={{color:'#ef4444'}}>{wrong}</div>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{width: `${progress}%`}} />
      </div>

      <div className="question-area">
        <div className="question-text">{question.text}</div>
      </div>

      <div className="answers-grid">
        {options.map((opt, i) => (
          <button
            key={i}
            className={`answer-btn${feedback?.idx === i ? (feedback.correct ? ' correct' : ' wrong') : ''}`}
            onClick={() => handleAnswer(opt, i)}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="streak-bar">
        {streak >= 3 ? `🔥 ${streak} in a row!` : streak >= 2 ? '⚡ Keep it up!' : ' '}
      </div>
    </div>
  )
}

function ResultsScreen({ result, onPlayAgain, onHome }) {
  const rating = getRating(result.score)
  const total = result.score + result.wrong
  const accuracy = total > 0 ? Math.round((result.score / total) * 100) : 0

  return (
    <div className="screen">
      <div className="results-emoji">{rating.emoji}</div>
      <h2 className="results-title">{rating.title}</h2>
      <p className="results-subtitle">{rating.msg}</p>

      <div className="results-stats">
        <div className="result-stat">
          <div className="stat-label">Score</div>
          <div className="stat-value" style={{color:'#7c3aed'}}>{result.score}</div>
        </div>
        <div className="result-stat">
          <div className="stat-label">Accuracy</div>
          <div className="stat-value" style={{color:'#10b981'}}>{accuracy}%</div>
        </div>
        <div className="result-stat">
          <div className="stat-label">Best Streak</div>
          <div className="stat-value" style={{color:'#f59e0b'}}>{result.bestStreak}</div>
        </div>
      </div>

      <div className="results-actions">
        <button className="play-again-btn" onClick={onPlayAgain}>
          🔁 Play Again
        </button>
        <button className="home-btn" onClick={onHome}>
          🏠 Home
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [config, setConfig] = useState(null)
  const [result, setResult] = useState(null)

  const handleStart = (tables, mode) => {
    setConfig({ table: tables, mode })
    setScreen('game')
  }

  const handleEnd = (r) => {
    setResult(r)
    setScreen('results')
  }

  if (screen === 'home') return <HomeScreen onStart={handleStart} />
  if (screen === 'game') return (
    <GameScreen
      key={JSON.stringify(config) + Date.now()}
      table={config.table}
      mode={config.mode}
      onEnd={handleEnd}
    />
  )
  return (
    <ResultsScreen
      result={result}
      onPlayAgain={() => setScreen('game')}
      onHome={() => { setConfig(null); setResult(null); setScreen('home') }}
    />
  )
}
