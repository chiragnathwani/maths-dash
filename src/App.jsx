import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// ── Constants ──────────────────────────────────────────────────────────────────
const GAME_DURATION = 60
const TABLES = [1,2,3,4,5,6,7,8,9,10,11,12]
const STORAGE_KEY = 'mathsdash'
const TOP_N = 5

const TIMES_MODES = [
  { id: 'times',    label: 'Times Tables',   icon: '✖️', desc: '6 × 7 = ?' },
  { id: 'division', label: 'Division',       icon: '➗', desc: '42 ÷ 7 = ?' },
  { id: 'missing',  label: 'Missing Number', icon: '❓', desc: '6 × ? = 42' },
  { id: 'mixed',    label: 'Mixed',          icon: '🔀', desc: 'All types!' },
]

const ROUNDING_MODES = [
  { id: 'round10',   label: 'Nearest 10',    icon: '🔟', desc: 'Round 47 → ?' },
  { id: 'round100',  label: 'Nearest 100',   icon: '💯', desc: 'Round 347 → ?' },
  { id: 'round1000', label: 'Nearest 1,000', icon: '🔢', desc: 'Round 3,472 → ?' },
]

const NL_CONFIGS = {
  nl_easy:   { min: 0, max: 20,   ticks: [0,5,10,15,20],       step: 1,  inputType: 'choice' },
  nl_medium: { min: 0, max: 100,  ticks: [0,25,50,75,100],     step: 5,  inputType: 'choice' },
  nl_ks2:    { min: 0, max: 1000, ticks: [0,250,500,750,1000], step: 50, inputType: 'pad'    },
}

const NL_MODES = [
  { id: 'nl_easy',   label: 'KS1 Easy',   icon: '📏', desc: '0 – 20' },
  { id: 'nl_medium', label: 'KS1 Medium', icon: '📐', desc: '0 – 100' },
  { id: 'nl_ks2',    label: 'KS2',        icon: '📊', desc: '0 – 1,000' },
]

const ALL_MODES = [...TIMES_MODES, ...ROUNDING_MODES, ...NL_MODES]
const ROUNDING_IDS = new Set(ROUNDING_MODES.map(m => m.id))
const NL_IDS     = new Set(NL_MODES.map(m => m.id))
const RANK_MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣']

// ── Storage ────────────────────────────────────────────────────────────────────
function loadStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function saveStorage(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
function addScoreToHistory(mode, score) {
  const s = loadStorage()
  const history = s.scoreHistory || {}
  const entry = { score, date: new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) }
  const updated = [...(history[mode]||[]), entry].sort((a,b)=>b.score-a.score).slice(0,TOP_N)
  saveStorage({ ...s, scoreHistory: { ...history, [mode]: updated } })
  return updated[0].score === score && updated[0] === entry
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a=[...arr]
  for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a
}

// ── Times table questions ──────────────────────────────────────────────────────
function generateTimesQuestion(table, mode) {
  const b = Math.floor(Math.random()*12)+1, product = table*b
  let m = mode
  if (m==='mixed') m=['times','division','missing'][Math.floor(Math.random()*3)]
  if (m==='times')    { const [x,y]=Math.random()>.5?[table,b]:[b,table]; return {text:`${x} × ${y} = ?`,answer:product} }
  if (m==='division') { return {text:`${product} ÷ ${table} = ?`,answer:b} }
  const [x,y]=Math.random()>.5?[table,b]:[b,table]; return {text:`${x} × ? = ${product}`,answer:y}
}
function generateTimesOptions(answer) {
  const opts=new Set([answer])
  for (const n of shuffle([answer-2,answer-1,answer+1,answer+2,answer-3,answer+3,answer*2,Math.max(1,answer-4)])) {
    if (n>0&&n!==answer) opts.add(n); if(opts.size===4) break
  }
  while (opts.size<4) opts.add(Math.floor(Math.random()*120)+1)
  return shuffle([...opts])
}

// ── Rounding questions ─────────────────────────────────────────────────────────
function generateRoundingQuestion(mode) {
  if (mode==='round10')   { let n; do{n=Math.floor(Math.random()*89)+11}while(n%10===0);   return {text:`Round ${n} to the nearest 10`,answer:Math.round(n/10)*10} }
  if (mode==='round100')  { let n; do{n=Math.floor(Math.random()*899)+101}while(n%100===0); return {text:`Round ${n} to the nearest 100`,answer:Math.round(n/100)*100} }
  let n; do{n=Math.floor(Math.random()*8999)+1001}while(n%1000===0)
  return {text:`Round ${n.toLocaleString()} to the nearest 1,000`,answer:Math.round(n/1000)*1000}
}
function generateRoundingOptions(answer, mode) {
  const unit=mode==='round10'?10:mode==='round100'?100:1000
  const opts=new Set([answer])
  for (const o of shuffle([1,2,3,-1,-2,-3])){const n=answer+o*unit;if(n>=0&&n!==answer)opts.add(n);if(opts.size===4)break}
  while(opts.size<4){const n=answer+(Math.floor(Math.random()*6)+1)*unit*(Math.random()>.5?1:-1);if(n>=0)opts.add(n)}
  return shuffle([...opts])
}

// ── Number line questions ──────────────────────────────────────────────────────
function generateNLQuestion(mode) {
  const {min,max,ticks,step,inputType} = NL_CONFIGS[mode]
  const isRead = Math.random() > 0.5

  if (isRead) {
    // Build pool of values not on labeled ticks
    const pool=[]
    if (step===1) { for(let v=min+1;v<max;v++) if(!ticks.includes(v)) pool.push(v) }
    else          { for(let v=min+step;v<max;v+=step) if(!ticks.includes(v)) pool.push(v) }
    const value = pool[Math.floor(Math.random()*pool.length)]
    return { type:'read', inputType, text:'What number is the arrow pointing to?', arrowAt:value, answer:value }
  } else {
    // "Place it" — pick target, create 4 section-based positions
    const range = max-min
    let target
    if (step===1) target = min+Math.floor(Math.random()*(range+1))
    else          target = min+Math.floor(Math.random()*(range/step+1))*step
    target = Math.max(min, Math.min(max, target))

    const sectionSize = range/4
    const targetSection = Math.min(3, Math.floor((target-min)/sectionSize))
    const positions = []
    for (let s=0;s<4;s++) {
      if (s===targetSection) { positions.push(target) }
      else {
        const sMin=min+s*sectionSize, sMax=min+(s+1)*sectionSize
        let v = step===1
          ? Math.round(sMin+Math.random()*(sMax-sMin))
          : Math.round((sMin+Math.random()*(sMax-sMin))/step)*step
        v = Math.max(min, Math.min(max, v))
        // avoid collision
        while (positions.includes(v)) v = v===max ? v-step : v+step
        positions.push(v)
      }
    }
    const sorted=[...new Set(positions)].sort((a,b)=>a-b).slice(0,4)
    const letters=['A','B','C','D']
    const optionPositions = sorted.map((v,i)=>({value:v,letter:letters[i]}))
    const correctLetter = optionPositions.find(o=>o.value===target)?.letter || 'A'
    return { type:'place', inputType:'choice', text:`Where does ${target.toLocaleString()} go?`, optionPositions, answer:correctLetter }
  }
}

function generateNLReadOptions(value, mode) {
  const {min,max,step} = NL_CONFIGS[mode]
  const opts=new Set([value])
  for (const o of shuffle([-3,-2,-1,1,2,3,4,-4])){const n=value+o*step;if(n>=min&&n<=max&&n!==value)opts.add(n);if(opts.size===4)break}
  while(opts.size<4){const n=value+(Math.floor(Math.random()*5)+1)*step*(Math.random()>.5?1:-1);if(n>=min&&n<=max)opts.add(n)}
  return shuffle([...opts])
}

function getRating(score) {
  if(score>=20) return {emoji:'🏆',title:'Maths Champion!',    msg:'Absolutely brilliant!'}
  if(score>=15) return {emoji:'⭐',title:'Super Star!',         msg:'Amazing work!'}
  if(score>=10) return {emoji:'😊',title:'Great Job!',          msg:"You're getting really good!"}
  if(score>=5)  return {emoji:'👍',title:'Good Effort!',        msg:'Keep practising!'}
  return             {emoji:'💪',title:'Keep Going!',           msg:'Practice makes perfect!'}
}

// ── NumberLineSVG ──────────────────────────────────────────────────────────────
function NumberLineSVG({ min, max, ticks, arrowAt, optionPositions }) {
  const W=320, H=75, lineY=52, x1=22, x2=296
  const toX = v => x1 + ((v-min)/(max-min)) * (x2-x1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block',maxWidth:500,margin:'0 auto'}}>
      {/* Main line */}
      <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke="#4f46e5" strokeWidth="3" strokeLinecap="round"/>
      {/* End arrow */}
      <polygon points={`${x2+9},${lineY} ${x2+1},${lineY-5} ${x2+1},${lineY+5}`} fill="#4f46e5"/>

      {/* Ticks */}
      {ticks.map(t => {
        const x=toX(t)
        return (
          <g key={t}>
            <line x1={x} y1={lineY-7} x2={x} y2={lineY+7} stroke="#4f46e5" strokeWidth="2"/>
            <text x={x} y={lineY+19} textAnchor="middle" fontSize="8" fill="#4b5563" fontFamily="sans-serif">
              {t.toLocaleString()}
            </text>
          </g>
        )
      })}

      {/* Arrow pointing down (read mode) */}
      {arrowAt !== undefined && (() => {
        const x=toX(arrowAt)
        return (
          <g>
            <text x={x} y={lineY-28} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#7c3aed" fontFamily="sans-serif">?</text>
            <line x1={x} y1={lineY-22} x2={x} y2={lineY-9} stroke="#7c3aed" strokeWidth="2.5"/>
            <polygon points={`${x},${lineY-7} ${x-5},${lineY-17} ${x+5},${lineY-17}`} fill="#7c3aed"/>
          </g>
        )
      })()}

      {/* Option circles (place mode) */}
      {optionPositions && optionPositions.map(({value,letter}) => {
        const x=toX(value)
        return (
          <g key={letter}>
            <line x1={x} y1={lineY-8} x2={x} y2={lineY-20} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="2,2"/>
            <circle cx={x} cy={lineY-28} r="10" fill="#7c3aed"/>
            <text x={x} y={lineY-24} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold" fontFamily="sans-serif">{letter}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── NumberPad ──────────────────────────────────────────────────────────────────
function NumberPad({ value, onChange, onSubmit }) {
  const rows=[['1','2','3'],['4','5','6'],['7','8','9'],['⌫','0','✓']]
  const handle = k => {
    if (k==='⌫') onChange(value.slice(0,-1))
    else if (k==='✓') { if(value) onSubmit() }
    else if (value.length<5) onChange(value+k)
  }
  return (
    <div className="number-pad">
      <div className="pad-display">{value || <span style={{opacity:0.3}}>?</span>}</div>
      {rows.map((row,i)=>(
        <div key={i} className="pad-row">
          {row.map(k=>(
            <button key={k} className={`pad-key${k==='✓'?' pad-submit':k==='⌫'?' pad-delete':''}`} onClick={()=>handle(k)}>
              {k}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Top Scores Panel ───────────────────────────────────────────────────────────
function TopScoresPanel({ onClose }) {
  const {scoreHistory={}} = loadStorage()
  const hasAny = ALL_MODES.some(m=>scoreHistory[m.id]?.length)

  const renderSection = (modes, title) => {
    const withScores = modes.filter(m=>scoreHistory[m.id]?.length)
    if (!withScores.length) return null
    return (
      <>
        <div className="top-scores-section-title">{title}</div>
        {withScores.map(m=>(
          <div key={m.id} className="top-scores-mode">
            <div className="top-scores-mode-title">{m.icon} {m.label}</div>
            <table className="top-scores-table"><tbody>
              {scoreHistory[m.id].map((e,i)=>(
                <tr key={i} className={i===0?'top-row':''}>
                  <td className="rank-cell">{RANK_MEDALS[i]}</td>
                  <td className="score-cell">{e.score}</td>
                  <td className="date-cell">{e.date}</td>
                </tr>
              ))}
            </tbody></table>
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
        ? <p style={{color:'#9ca3af',fontSize:'0.9rem',textAlign:'center',padding:'16px 0'}}>No scores yet — play a game!</p>
        : <>{renderSection(TIMES_MODES,'✖️ Times Tables')}{renderSection(ROUNDING_MODES,'🔢 Rounding')}{renderSection(NL_MODES,'📏 Number Lines')}</>
      }
    </div>
  )
}

// ── Home Screen ────────────────────────────────────────────────────────────────
function HomeScreen({ onStart }) {
  const stored = loadStorage()
  const [selectedTables, setSelectedTables] = useState(()=>new Set(Array.isArray(stored.lastTables)&&stored.lastTables.length?stored.lastTables:[]))
  const [selectedMode,   setSelectedMode]   = useState(stored.lastMode||'times')
  const [timed,          setTimed]          = useState(true)
  const [showScores,     setShowScores]     = useState(false)

  const isRounding = ROUNDING_IDS.has(selectedMode)
  const isNL       = NL_IDS.has(selectedMode)
  const needsTables = !isRounding && !isNL
  const canStart    = !needsTables || selectedTables.size > 0

  const scoreHistory = stored.scoreHistory||{}
  const bestScores   = Object.fromEntries(ALL_MODES.map(m=>[m.id,scoreHistory[m.id]?.[0]?.score||0]))
  const hasAnyScores = ALL_MODES.some(m=>bestScores[m.id]>0)

  const toggleTable = t => setSelectedTables(prev=>{const n=new Set(prev);n.has(t)?n.delete(t):n.add(t);return n})

  const handleStart = () => {
    const tables = needsTables ? [...selectedTables] : []
    saveStorage({...loadStorage(), lastTables:tables, lastMode:selectedMode})
    onStart(tables, selectedMode, timed)
  }

  return (
    <div className="screen">
      <img src="/logo.png" alt="Maths Dash logo" className="logo-img"/>
      <h1 className="home-title">Maths Dash!</h1>
      <p className="home-subtitle">Fast-fire maths practice for kids</p>

      {/* Times table selector */}
      {needsTables && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <p className="section-label" style={{margin:0}}>Choose your times tables</p>
            <div style={{display:'flex',gap:8}}>
              <button className="tiny-btn" onClick={()=>setSelectedTables(new Set(TABLES))}>All</button>
              <button className="tiny-btn" onClick={()=>setSelectedTables(new Set())}>Clear</button>
            </div>
          </div>
          <div className="table-grid">
            {TABLES.map(t=>(
              <button key={t} className={`table-btn${selectedTables.has(t)?' selected':''}`} onClick={()=>toggleTable(t)}>{t}×</button>
            ))}
          </div>
        </>
      )}

      {/* Times Tables modes */}
      <p className="section-label" style={{marginTop:needsTables?16:0}}>Times Tables</p>
      <div className="mode-grid">
        {TIMES_MODES.map(m=>(
          <button key={m.id} className={`mode-btn${selectedMode===m.id?' selected':''}`} onClick={()=>setSelectedMode(m.id)}>
            <span className="mode-icon">{m.icon}</span>{m.label}
            <br/><small style={{fontWeight:400,opacity:0.8}}>{m.desc}</small>
            {bestScores[m.id]>0&&<span className="mode-best">🏅 Best: {bestScores[m.id]}</span>}
          </button>
        ))}
      </div>

      {/* Rounding modes */}
      <p className="section-label" style={{marginTop:16}}>Rounding</p>
      <div className="mode-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {ROUNDING_MODES.map(m=>(
          <button key={m.id} className={`mode-btn${selectedMode===m.id?' selected':''}`} onClick={()=>setSelectedMode(m.id)}>
            <span className="mode-icon">{m.icon}</span>{m.label}
            <br/><small style={{fontWeight:400,opacity:0.8}}>{m.desc}</small>
            {bestScores[m.id]>0&&<span className="mode-best">🏅 Best: {bestScores[m.id]}</span>}
          </button>
        ))}
      </div>

      {/* Number Line modes */}
      <p className="section-label" style={{marginTop:16}}>Number Lines</p>
      <div className="mode-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {NL_MODES.map(m=>(
          <button key={m.id} className={`mode-btn${selectedMode===m.id?' selected':''}`} onClick={()=>setSelectedMode(m.id)}>
            <span className="mode-icon">{m.icon}</span>{m.label}
            <br/><small style={{fontWeight:400,opacity:0.8}}>{m.desc}</small>
            {bestScores[m.id]>0&&<span className="mode-best">🏅 Best: {bestScores[m.id]}</span>}
          </button>
        ))}
      </div>

      {/* Timed toggle (number lines only) */}
      {isNL && (
        <div className="timed-toggle">
          <span className="section-label" style={{margin:0}}>Mode</span>
          <div className="toggle-btns">
            <button className={`toggle-opt${timed?' active':''}`}  onClick={()=>setTimed(true)}>⏱ Timed (60s)</button>
            <button className={`toggle-opt${!timed?' active':''}`} onClick={()=>setTimed(false)}>∞ Untimed</button>
          </div>
        </div>
      )}

      <button className="start-btn" disabled={!canStart} onClick={handleStart}>▶ Start!</button>
      {!canStart && <p style={{marginTop:12,color:'#9ca3af',fontSize:'0.9rem'}}>Pick at least one times table to begin</p>}

      {hasAnyScores && (
        <div className="best-scores-section">
          <button className="tiny-btn scores-toggle-btn" onClick={()=>setShowScores(s=>!s)}>
            🏆 {showScores?'Hide Top Scores':'View Top Scores'}
          </button>
          {showScores && <TopScoresPanel onClose={()=>setShowScores(false)}/>}
        </div>
      )}
    </div>
  )
}

// ── Regular Game Screen (times + rounding) ─────────────────────────────────────
function GameScreen({ table, mode, onEnd }) {
  const [question,setQuestion]=useState(null)
  const [options,setOptions]=useState([])
  const [score,setScore]=useState(0)
  const [wrong,setWrong]=useState(0)
  const [timeLeft,setTimeLeft]=useState(GAME_DURATION)
  const [feedback,setFeedback]=useState(null)
  const [streak,setStreak]=useState(0)
  const [bestStreak,setBestStreak]=useState(0)
  const streakRef=useRef(0), lockedRef=useRef(false), endedRef=useRef(false)

  const nextQuestion = useCallback(()=>{
    let q,opts
    if (ROUNDING_IDS.has(mode)) { q=generateRoundingQuestion(mode); opts=generateRoundingOptions(q.answer,mode) }
    else { const t=table[Math.floor(Math.random()*table.length)]; q=generateTimesQuestion(t,mode); opts=generateTimesOptions(q.answer) }
    setQuestion(q); setOptions(opts); setFeedback(null); lockedRef.current=false
  },[table,mode])

  useEffect(()=>{nextQuestion()},[nextQuestion])
  useEffect(()=>{ if(timeLeft<=0)return; const id=setInterval(()=>setTimeLeft(t=>t-1),1000); return()=>clearInterval(id) },[timeLeft])
  useEffect(()=>{ if(timeLeft===0&&!endedRef.current){endedRef.current=true;onEnd({score,wrong,bestStreak:Math.max(bestStreak,streakRef.current)})} })

  const handleAnswer=(val,idx)=>{
    if(lockedRef.current||timeLeft===0)return; lockedRef.current=true
    const correct=val===question.answer
    setFeedback({idx,correct})
    if(correct){streakRef.current+=1;setStreak(streakRef.current);setBestStreak(p=>Math.max(p,streakRef.current));setScore(s=>s+1)}
    else{streakRef.current=0;setStreak(0);setWrong(w=>w+1)}
    setTimeout(()=>nextQuestion(),380)
  }

  if(!question) return null
  return (
    <div className="screen">
      <div className="game-header">
        <div className="stat-box score-box"><div className="stat-label">Score</div><div className="stat-value">{score}</div></div>
        <div className={`stat-box timer-box${timeLeft<=10?' danger':''}`}><div className="stat-label">Time</div><div className="stat-value">{timeLeft}s</div></div>
        <div className="stat-box"><div className="stat-label">Wrong</div><div className="stat-value" style={{color:'#ef4444'}}>{wrong}</div></div>
      </div>
      <div className="progress-bar"><div className="progress-fill" style={{width:`${(timeLeft/GAME_DURATION)*100}%`}}/></div>
      <div className="question-area"><div className="question-text">{question.text}</div></div>
      <div className="answers-grid">
        {options.map((opt,i)=>(
          <button key={i} className={`answer-btn${feedback?.idx===i?(feedback.correct?' correct':' wrong'):''}`} onClick={()=>handleAnswer(opt,i)}>
            {opt.toLocaleString()}
          </button>
        ))}
      </div>
      <div className="streak-bar">{streak>=3?`🔥 ${streak} in a row!`:streak>=2?'⚡ Keep it up!':' '}</div>
    </div>
  )
}

// ── Number Line Game Screen ────────────────────────────────────────────────────
function NumberLineGameScreen({ mode, timed, onEnd }) {
  const cfg = NL_CONFIGS[mode]
  const [question,setQuestion]=useState(null)
  const [choiceOpts,setChoiceOpts]=useState([])
  const [padValue,setPadValue]=useState('')
  const [score,setScore]=useState(0)
  const [wrong,setWrong]=useState(0)
  const [timeLeft,setTimeLeft]=useState(GAME_DURATION)
  const [feedback,setFeedback]=useState(null)
  const [streak,setStreak]=useState(0)
  const [bestStreak,setBestStreak]=useState(0)
  const streakRef=useRef(0), lockedRef=useRef(false), endedRef=useRef(false)

  const nextQuestion = useCallback(()=>{
    const q=generateNLQuestion(mode)
    setQuestion(q)
    if (q.type==='read'&&q.inputType==='choice') setChoiceOpts(generateNLReadOptions(q.answer,mode))
    else if (q.type==='place') setChoiceOpts(q.optionPositions.map(o=>o.letter))
    setPadValue(''); setFeedback(null); lockedRef.current=false
  },[mode])

  useEffect(()=>{nextQuestion()},[nextQuestion])
  useEffect(()=>{ if(!timed||timeLeft<=0)return; const id=setInterval(()=>setTimeLeft(t=>t-1),1000); return()=>clearInterval(id) },[timeLeft,timed])
  useEffect(()=>{ if(timed&&timeLeft===0&&!endedRef.current){endedRef.current=true;onEnd({score,wrong,bestStreak:Math.max(bestStreak,streakRef.current)})} })

  const handleAnswer = val => {
    if(lockedRef.current)return; if(timed&&timeLeft===0)return
    lockedRef.current=true
    const correct = String(val)===String(question.answer)
    setFeedback({correct,picked:String(val),shownAnswer:String(question.answer)})
    if(correct){streakRef.current+=1;setStreak(streakRef.current);setBestStreak(p=>Math.max(p,streakRef.current));setScore(s=>s+1)}
    else{streakRef.current=0;setStreak(0);setWrong(w=>w+1)}
    setTimeout(()=>nextQuestion(),600)
  }

  if(!question) return null

  return (
    <div className="screen">
      <div className="game-header">
        <div className="stat-box score-box"><div className="stat-label">Score</div><div className="stat-value">{score}</div></div>
        {timed
          ? <div className={`stat-box timer-box${timeLeft<=10?' danger':''}`}><div className="stat-label">Time</div><div className="stat-value">{timeLeft}s</div></div>
          : <div className="stat-box"><div className="stat-label">Range</div><div className="stat-value" style={{fontSize:'0.95rem'}}>{cfg.min}–{cfg.max.toLocaleString()}</div></div>
        }
        <div className="stat-box"><div className="stat-label">Wrong</div><div className="stat-value" style={{color:'#ef4444'}}>{wrong}</div></div>
      </div>

      {timed && <div className="progress-bar"><div className="progress-fill" style={{width:`${(timeLeft/GAME_DURATION)*100}%`}}/></div>}

      <div className="nl-question">{question.text}</div>

      <div className="nl-line-wrap">
        <NumberLineSVG
          min={cfg.min} max={cfg.max} ticks={cfg.ticks}
          arrowAt={question.type==='read'?question.arrowAt:undefined}
          optionPositions={question.type==='place'?question.optionPositions:undefined}
        />
      </div>

      {feedback && (
        <div className={`nl-feedback ${feedback.correct?'nl-correct':'nl-wrong'}`}>
          {feedback.correct ? '✓ Correct!' : `✗ Answer: ${question.type==='read'?Number(feedback.shownAnswer).toLocaleString():feedback.shownAnswer}`}
        </div>
      )}

      {question.inputType==='choice' || question.type==='place' ? (
        <div className={`answers-grid${question.type==='place'?' place-grid':''}`}>
          {choiceOpts.map((opt,i)=>(
            <button key={i} disabled={!!feedback}
              className={`answer-btn${feedback?(String(opt)===feedback.shownAnswer?' correct':String(opt)===feedback.picked&&!feedback.correct?' wrong':''):''}`}
              onClick={()=>handleAnswer(opt)}>
              {question.type==='read'?Number(opt).toLocaleString():opt}
            </button>
          ))}
        </div>
      ) : (
        <NumberPad value={padValue} onChange={setPadValue} onSubmit={()=>handleAnswer(parseInt(padValue,10))}/>
      )}

      <div className="streak-bar">{streak>=3?`🔥 ${streak} in a row!`:streak>=2?'⚡ Keep it up!':' '}</div>

      {!timed && (
        <button className="home-btn" style={{marginTop:8}}
          onClick={()=>onEnd({score,wrong,bestStreak:Math.max(bestStreak,streakRef.current)})}>
          🏁 Finish
        </button>
      )}
    </div>
  )
}

// ── Results Screen ─────────────────────────────────────────────────────────────
function ResultsScreen({ result, mode, onPlayAgain, onHome }) {
  const rating=getRating(result.score)
  const total=result.score+result.wrong
  const accuracy=total>0?Math.round((result.score/total)*100):0
  const [isNewBest,setIsNewBest]=useState(false)
  const [prevBest,setPrevBest]=useState(0)

  useEffect(()=>{
    const {scoreHistory={}}=loadStorage()
    const prev=scoreHistory[mode]?.[0]?.score||0
    setPrevBest(prev)
    setIsNewBest(addScoreToHistory(mode,result.score)&&result.score>=prev)
  },[])

  return (
    <div className="screen">
      <div className="results-emoji">{rating.emoji}</div>
      <h2 className="results-title">{rating.title}</h2>
      <p className="results-subtitle">{rating.msg}</p>
      {isNewBest&&<div className="new-best-banner">🎉 New best score!</div>}
      <div className="results-stats">
        <div className="result-stat"><div className="stat-label">Score</div><div className="stat-value" style={{color:'#7c3aed'}}>{result.score}</div></div>
        <div className="result-stat"><div className="stat-label">Accuracy</div><div className="stat-value" style={{color:'#10b981'}}>{accuracy}%</div></div>
        <div className="result-stat"><div className="stat-label">Best Streak</div><div className="stat-value" style={{color:'#f59e0b'}}>{result.bestStreak}</div></div>
      </div>
      {prevBest>0&&!isNewBest&&(
        <p style={{color:'#6b7280',fontSize:'0.9rem',marginBottom:20}}>🏅 Your best for this mode: <strong>{prevBest}</strong></p>
      )}
      <div className="results-actions">
        <button className="play-again-btn" onClick={onPlayAgain}>🔁 Play Again</button>
        <button className="home-btn" onClick={onHome}>🏠 Home</button>
      </div>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState('home')
  const [config,setConfig]=useState(null)
  const [result,setResult]=useState(null)

  const handleEnd = r => { setResult(r); setScreen('results') }

  if (screen==='home') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'100%'}}>
      <HomeScreen onStart={(tables,mode,timed)=>{setConfig({table:tables,mode,timed});setScreen('game')}}/>
      <footer className="footer">
        <a href="https://ko-fi.com/activlearn" target="_blank" rel="noopener noreferrer" className="kofi-btn">☕ Support us on Ko-fi</a>
        <div style={{marginTop:8}}>© 2026 Activ Ops Solutions Ltd. All rights reserved.</div>
      </footer>
    </div>
  )

  if (screen==='game') {
    const key=JSON.stringify(config)+Date.now()
    if (NL_IDS.has(config.mode)) return <NumberLineGameScreen key={key} mode={config.mode} timed={config.timed} onEnd={handleEnd}/>
    return <GameScreen key={key} table={config.table} mode={config.mode} onEnd={handleEnd}/>
  }

  return (
    <ResultsScreen result={result} mode={config.mode}
      onPlayAgain={()=>setScreen('game')}
      onHome={()=>{setConfig(null);setResult(null);setScreen('home')}}/>
  )
}
