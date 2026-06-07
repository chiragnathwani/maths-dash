import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const GAME_DURATION = 60
const TABLES = [1,2,3,4,5,6,7,8,9,10,11,12]
const STORAGE_KEY = 'mathsdash'
const TOP_N = 5

const TIMES_MODES = [
  { id: 'times',   label: 'Times Tables',   icon: '✖️', desc: '6 × 7 = ?' },
  { id: 'division', label: 'Division',      icon: '➗', desc: '42 ÷ 7 = ?' },
  { id: 'missing',  label: 'Missing Number', icon: '❓', desc: '6 × ? = 42' },
  { id: 'mixed',    label: 'Mixed',          icon: '🔀', desc: 'All types!' },
]

const ROUNDING_MODES = [
  { id: 'round10',   label: 'Nearest 10',    icon: '🔟', desc: 'Round 47 → ?' },
  { id: 'round100',  label: 'Nearest 100',   icon: '💯', desc: 'Round 347 → ?' },
  { id: 'round1000', label: 'Nearest 1,000', icon: '🔢', desc: 'Round 3,472 → ?' },
]

const ALL_MODES = [...TIMES_MODES, ...ROUNDING_MODES]
const ROUNDING_IDS = new Set(ROUNDING_MODES.map(m => m.id))

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

// ── Storage ───────────────────────────────────────────────────────────────────
function loadStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} }
  catch { return {} }
}
function saveStorage(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
function addScoreToHistory(mode, score) {
  const s = loadStorage()
  const history = s.scoreHistory || {}
  const entry = { score, date: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
  const updated = [...(history[mode] || []), entry].sort((a,b) => b.score - a.score).slice(0, TOP_N)
  saveStorage({ ...s, scoreHistory: { ...history, [mode]: updated } })
  return updated[0].score === score && updated[0] === entry
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Times table questions ─────────────────────────────────────────────────────
function generateTimesQuestion(table, mode) {
  const b = Math.floor(Math.random() * 12) + 1
  const product = table * b
  let actualMode = mode
  if (mode === 'mixed') actualMode = ['times', 'division', 'missing'][Math.floor(Math.random() * 3)]
  if (actualMode === 'times') {
    const [x, y] = Math.random() > 0.5 ? [table, b] : [b, table]
    return { text: `${x} × ${y} = ?`, answer: product }
  } else if (actualMode === 'division') {
    return { text: `${product} ÷ ${table} = ?`, answer: b }
  } else {
    const [x, y] = Math.random() > 0.5 ? [table, b] : [b, table]
    return { text: `${x} × ? = ${product}`, answer: y }
  }
}

function generateTimesOptions(answer) {
  const options = new Set([answer])
  const nearby = [answer-2, answer-1, answer+1, answer+2, answer-3, answer+3, answer*2, Math.max(1, answer-4)]
  for (const n of shuffle(nearby)) {
    if (n > 0 && n !== answer) options.add(n)
    if (options.size === 4) break
  }
  while (options.size < 4) options.add(Math.floor(Math.random() * 120) + 1)
  return shuffle([...options])
}

// ── Rounding questions ────────────────────────────────────────────────────────
function generateRoundingQuestion(mode) {
  if (mode === 'round10') {
    // avoid exact multiples of 10
    let n
    do { n = Math.floor(Math.random() * 89) + 11 } while (n % 10 === 0)
    const answer = Math.round(n / 10) * 10
    return { text: `Round ${n} to the nearest 10`, answer }
  } else if (mode === 'round100') {
    let n
    do { n = Math.floor(Math.random() * 899) + 101 } while (n % 100 === 0)
    const answer = Math.round(n / 100) * 100
    return { text: `Round ${n} to the nearest 100`, answer }
  } else {
    let n
    do { n = Math.floor(Math.random() * 8999) + 1001 } while (n % 1000 === 0)
    const answer = Math.round(n / 1000) * 1000
    return { text: `Round ${n.toLocaleString()} to the nearest 1,000`, answer }
  }
}

function generateRoundingOptions(answer, mode) {
  const unit = mode === 'round10' ? 10 : mode === 'round100' ? 100 : 1000
  const options = new Set([answer])
  const offsets = [1, 2, 3, -1, -2, -3]
  for (const o of shuffle(offsets)) {
    const n = answer + o * unit
    if (n >= 0 && n !== answer) options.add(n)
    if (options.size === 4) break
  }
  while (options.size < 4) {
    const n = answer + (Math.floor(Math.random() * 6) + 1) * unit * (Math.random() > 0.5 ? 1 : -1)
    if (n >= 0) options.add(n)
  }
  return shuffle([...options])
}

function getRating(score) {
  if (score >= 20) return { emoji: '🏆', title: 'Maths Champion!', msg: 'Absolutely brilliant!' }
  if (score >= 15) return { emoji: '⭐', title: 'Super Star!', msg: 'Amazing work!' }
  if (score >= 10) return { emoji: '😊', title: 'Great Job!', msg: "You're getting really good!" }
  if (score >= 5)  return { emoji: '👍', title: 'Good Effort!', msg: 'Keep practising!' }
  return { emoji: '💪', title: 'Keep Going!', msg: 'Practice makes perfect!' }
}

// ── Top Scores Panel ──────────────────────────────────────────────────────────
function TopScoresPanel({ onClose }) {
  const { scoreHistory = {} } = loadStorage()
  const hasAny = ALL_MODES.some(m => scoreHistory[m.id]?.length)

  const renderSection = (modes, title) => {
    const withScores = modes.filter(m => scoreHistory[m.id]?.length)
    if (!withScores.length) return null
    return (
      <>
        <div className="top-scores-section-title">{title}</div>
        {withScores.map(m => (
          <div key={m.id} className="top-scores-mode">
            <div className="top-scores-mode-title">{m.icon} {m.label}</div>
            <table className="top-scores-table">
              <tbody>
                {scoreHistory[m.id].map((e, i) => (
                  <tr key={i} className={i === 0 ? 'top-row' : ''}>
                    <td className="rank-cell">{RANK_MEDALS[i]}</td>
                    <td className="score-cell">{e.score}</td>
                    <td className="date-cell">{e.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="top-scores-panel">
      <div className="top-scores-header">
        <h3 className="top-scores-title">🏆 Top Scores</h3>
        <button className="tiny-btn" onClick={onClose}>✕ Close</button>
      </div>
      {!hasAny
        ? <p style={{color:'#9ca3af', fontSize:'0.9rem', textAlign:'center', padding:'16px 0'}}>No scores yet — play a game!</p>
        : <>
            {renderSection(TIMES_MODES, '✖️ Times Tables')}
            {renderSection(ROUNDING_MODES, '🔢 Rounding')}
          </>
      }
    </div>
  )
}

// ── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen({ onStart }) {
  const stored = loadStorage()
  const [selectedTables, setSelectedTables] = useState(() =>
    new Set(Array.isArray(stored.lastTables) && stored.lastTables.length ? stored.lastTables : [])
  )
  const [selectedMode, setSelectedMode] = useState(stored.lastMode || 'times')
  const [showScores, setShowScores] = useState(false)

  const isRounding = ROUNDING_IDS.has(selectedMode)
  const scoreHistory = stored.scoreHistory || {}
  const bestScores = Object.fromEntries(ALL_MODES.map(m => [m.id, scoreHistory[m.id]?.[0]?.score || 0]))
  const hasAnyScores = ALL_MODES.some(m => bestScores[m.id] > 0)
  const canStart = isRounding || selectedTables.size > 0

  const toggleTable = (t) => setSelectedTables(prev => {
    const next = new Set(prev)
    next.has(t) ? next.delete(t) : next.add(t)
    return next
  })

  const handleStart = () => {
    const tables = isRounding ? [] : [...selectedTables]
    saveStorage({ ...loadStorage(), lastTables: tables, lastMode: selectedMode })
    onStart(tables, selectedMode)
  }

  return (
    <div className="screen">
      <img src="/logo.png" alt="Maths Dash logo" className="logo-img" />
      <h1 className="home-title">Maths Dash!</h1>
      <p className="home-subtitle">Fast-fire maths practice for kids</p>

      {/* Times table selector — hidden for rounding modes */}
      {!isRounding && (
        <>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
            <p className="section-label" style={{margin:0}}>Choose your times tables</p>
            <div style={{display:'flex', gap:8}}>
              <button className="tiny-btn" onClick={() => setSelectedTables(new Set(TABLES))}>All</button>
              <button className="tiny-btn" onClick={() => setSelectedTables(new Set())}>Clear</button>
            </div>
          </div>
          <div className="table-grid">
            {TABLES.map(t => (
              <button key={t} className={`table-btn${selectedTables.has(t) ? ' selected' : ''}`} onClick={() => toggleTable(t)}>
                {t}×
              </button>
            ))}
          </div>
        </>
      )}

      <p className="section-label" style={{marginTop: isRounding ? 0 : 16}}>Times Tables</p>
      <div className="mode-grid">
        {TIMES_MODES.map(m => (
          <button key={m.id} className={`mode-btn${selectedMode === m.id ? ' selected' : ''}`} onClick={() => setSelectedMode(m.id)}>
            <span className="mode-icon">{m.icon}</span>
            {m.label}
            <br /><small style={{fontWeight:400, opacity:0.8}}>{m.desc}</small>
            {bestScores[m.id] > 0 && <span className="mode-best">🏅 Best: {bestScores[m.id]}</span>}
          </button>
        ))}
      </div>

      <p className="section-label" style={{marginTop:16}}>Rounding</p>
      <div className="mode-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {ROUNDING_MODES.map(m => (
          <button key={m.id} className={`mode-btn${selectedMode === m.id ? ' selected' : ''}`} onClick={() => setSelectedMode(m.id)}>
            <span className="mode-icon">{m.icon}</span>
            {m.label}
            <br /><small style={{fontWeight:400, opacity:0.8}}>{m.desc}</small>
            {bestScores[m.id] > 0 && <span className="mode-best">🏅 Best: {bestScores[m.id]}</span>}
          </button>
        ))}
      </div>

      <button className="start-btn" disabled={!canStart} onClick={handleStart}>
        ▶ Start!
      </button>
      {!canStart && (
        <p style={{marginTop:12, color:'#9ca3af', fontSize:'0.9rem'}}>Pick at least one times table to begin</p>
      )}

      {hasAnyScores && (
        <div className="best-scores-section">
          <button className="tiny-btn scores-toggle-btn" onClick={() => setShowScores(s => !s)}>
            🏆 {showScores ? 'Hide Top Scores' : 'View Top Scores'}
          </button>
          {showScores && <TopScoresPanel onClose={() => setShowScores(false)} />}
        </div>
      )}
    </div>
  )
}

// ── Game Screen ───────────────────────────────────────────────────────────────
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
    let q, opts
    if (ROUNDING_IDS.has(mode)) {
      q = generateRoundingQuestion(mode)
      opts = generateRoundingOptions(q.answer, mode)
    } else {
      const resolvedTable = table[Math.floor(Math.random() * table.length)]
      q = generateTimesQuestion(resolvedTable, mode)
      opts = generateTimesOptions(q.answer)
    }
    setQuestion(q); setOptions(opts); setFeedback(null)
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
      streakRef.current += 1; setStreak(streakRef.current)
      setBestStreak(prev => Math.max(prev, streakRef.current))
      setScore(sc => sc + 1)
    } else {
      streakRef.current = 0; setStreak(0); setWrong(w => w + 1)
    }
    setTimeout(() => nextQuestion(), 380)
  }

  if (!question) return null
  const progress = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="screen">
      <div className="game-header">
        <div className="stat-box score-box"><div className="stat-label">Score</div><div className="stat-value">{score}</div></div>
        <div className={`stat-box timer-box${timeLeft <= 10 ? ' danger' : ''}`}><div className="stat-label">Time</div><div className="stat-value">{timeLeft}s</div></div>
        <div className="stat-box"><div className="stat-label">Wrong</div><div className="stat-value" style={{color:'#ef4444'}}>{wrong}</div></div>
      </div>
      <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}} /></div>
      <div className="question-area"><div className="question-text">{question.text}</div></div>
      <div className="answers-grid">
        {options.map((opt, i) => (
          <button key={i} className={`answer-btn${feedback?.idx === i ? (feedback.correct ? ' correct' : ' wrong') : ''}`} onClick={() => handleAnswer(opt, i)}>
            {opt.toLocaleString()}
          </button>
        ))}
      </div>
      <div className="streak-bar">{streak >= 3 ? `🔥 ${streak} in a row!` : streak >= 2 ? '⚡ Keep it up!' : ' '}</div>
    </div>
  )
}

// ── Results Screen ────────────────────────────────────────────────────────────
function ResultsScreen({ result, mode, onPlayAgain, onHome }) {
  const rating = getRating(result.score)
  const total = result.score + result.wrong
  const accuracy = total > 0 ? Math.round((result.score / total) * 100) : 0
  const [isNewBest, setIsNewBest] = useState(false)
  const [prevBest, setPrevBest] = useState(0)

  useEffect(() => {
    const { scoreHistory = {} } = loadStorage()
    const prev = scoreHistory[mode]?.[0]?.score || 0
    setPrevBest(prev)
    setIsNewBest(addScoreToHistory(mode, result.score) && result.score >= prev)
  }, [])

  return (
    <div className="screen">
      <div className="results-emoji">{rating.emoji}</div>
      <h2 className="results-title">{rating.title}</h2>
      <p className="results-subtitle">{rating.msg}</p>
      {isNewBest && <div className="new-best-banner">🎉 New best score!</div>}
      <div className="results-stats">
        <div className="result-stat"><div className="stat-label">Score</div><div className="stat-value" style={{color:'#7c3aed'}}>{result.score}</div></div>
        <div className="result-stat"><div className="stat-label">Accuracy</div><div className="stat-value" style={{color:'#10b981'}}>{accuracy}%</div></div>
        <div className="result-stat"><div className="stat-label">Best Streak</div><div className="stat-value" style={{color:'#f59e0b'}}>{result.bestStreak}</div></div>
      </div>
      {prevBest > 0 && !isNewBest && (
        <p style={{color:'#6b7280', fontSize:'0.9rem', marginBottom:20}}>🏅 Your best for this mode: <strong>{prevBest}</strong></p>
      )}
      <div className="results-actions">
        <button className="play-again-btn" onClick={onPlayAgain}>🔁 Play Again</button>
        <button className="home-btn" onClick={onHome}>🏠 Home</button>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home')
  const [config, setConfig] = useState(null)
  const [result, setResult] = useState(null)

  if (screen === 'home') return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%'}}>
      <HomeScreen onStart={(tables, mode) => { setConfig({ table: tables, mode }); setScreen('game') }} />
      <footer className="footer">
        <a href="https://ko-fi.com/activlearn" target="_blank" rel="noopener noreferrer" className="kofi-btn">
          ☕ Support us on Ko-fi
        </a>
        <div style={{marginTop:8}}>© 2026 Activ Ops Solutions Ltd. All rights reserved.</div>
      </footer>
    </div>
  )
  if (screen === 'game') return (
    <GameScreen key={JSON.stringify(config) + Date.now()} table={config.table} mode={config.mode}
      onEnd={r => { setResult(r); setScreen('results') }} />
  )
  return (
    <ResultsScreen result={result} mode={config.mode}
      onPlayAgain={() => setScreen('game')}
      onHome={() => { setConfig(null); setResult(null); setScreen('home') }} />
  )
}
