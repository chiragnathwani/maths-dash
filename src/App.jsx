import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// ── Constants ──────────────────────────────────────────────────────────────────
const GAME_DURATION = 60
const TABLES = [1,2,3,4,5,6,7,8,9,10,11,12]
const STORAGE_KEY = 'mathsdash'
const TOP_N = 5

const TIMES_MODES = [
  { id:'times',    label:'Times Tables',   icon:'✖️', desc:'6 × 7 = ?' },
  { id:'division', label:'Division',       icon:'➗', desc:'42 ÷ 7 = ?' },
  { id:'missing',  label:'Missing Number', icon:'❓', desc:'6 × ? = 42' },
  { id:'mixed',    label:'Mixed',          icon:'🔀', desc:'All types!' },
]
const ROUNDING_MODES = [
  { id:'round10',   label:'Nearest 10',    icon:'🔟', desc:'Round 47 → ?' },
  { id:'round100',  label:'Nearest 100',   icon:'💯', desc:'Round 347 → ?' },
  { id:'round1000', label:'Nearest 1,000', icon:'🔢', desc:'Round 3,472 → ?' },
]
const NL_CONFIGS = {
  nl_easy:   { min:0, max:20,   ticks:[0,5,10,15,20],       step:1,  inputType:'choice' },
  nl_medium: { min:0, max:100,  ticks:[0,25,50,75,100],     step:5,  inputType:'choice' },
  nl_ks2:    { min:0, max:1000, ticks:[0,250,500,750,1000], step:50, inputType:'pad'    },
}
const NL_MODES = [
  { id:'nl_easy',   label:'KS1 Easy',   icon:'📏', desc:'0 – 20' },
  { id:'nl_medium', label:'KS1 Medium', icon:'📐', desc:'0 – 100' },
  { id:'nl_ks2',    label:'KS2',        icon:'📊', desc:'0 – 1,000' },
]
const TIME_MODES = [
  { id:'time_oclock',  label:"O'clock & Half Past",  icon:'🕛', desc:"3 o'clock" },
  { id:'time_quarter', label:'Quarter Past & To',    icon:'🕒', desc:'Quarter past 4' },
  { id:'time_5min',    label:'5-Minute Intervals',   icon:'🕔', desc:'20 past 7' },
  { id:'time_any',     label:'Any Time',             icon:'⏱️', desc:'3:47' },
]
const FRAC_MODES = [
  { id:'frac_basic',   label:'Identify Fractions',    icon:'🟪', desc:'What fraction?' },
  { id:'frac_amounts', label:'Fractions of Amounts',  icon:'🔢', desc:'¼ of 20 = ?' },
  { id:'frac_equiv',   label:'Equivalent Fractions',  icon:'🟰', desc:'½ = ?/4' },
  { id:'frac_compare', label:'Compare Fractions',     icon:'⚖️', desc:'Which is largest?' },
]

const ALL_MODES    = [...TIMES_MODES,...ROUNDING_MODES,...NL_MODES,...TIME_MODES,...FRAC_MODES]
const ROUNDING_IDS = new Set(ROUNDING_MODES.map(m=>m.id))
const NL_IDS       = new Set(NL_MODES.map(m=>m.id))
const TIME_IDS     = new Set(TIME_MODES.map(m=>m.id))
const FRAC_IDS     = new Set(FRAC_MODES.map(m=>m.id))
const NO_TABLES    = new Set([...ROUNDING_IDS,...NL_IDS,...TIME_IDS,...FRAC_IDS])
const RANK_MEDALS  = ['🥇','🥈','🥉','4️⃣','5️⃣']

const CATEGORIES = [
  { id:'times-tables', label:'Times Tables',    icon:'✖️', color:'linear-gradient(135deg,#7c3aed,#4f46e5)', modes:TIMES_MODES,    desc:'Multiplication, division & more',   needsTables:true },
  { id:'rounding',     label:'Rounding',        icon:'🎯', color:'linear-gradient(135deg,#0891b2,#0e7490)', modes:ROUNDING_MODES, desc:'Round to 10, 100 & 1,000',          needsTables:false },
  { id:'number-lines', label:'Number Lines',    icon:'📏', color:'linear-gradient(135deg,#059669,#047857)', modes:NL_MODES,       desc:'Read & place numbers on a line',    needsTables:false, hasTimed:true },
  { id:'time',         label:'Telling the Time',icon:'🕐', color:'linear-gradient(135deg,#d97706,#b45309)', modes:TIME_MODES,     desc:"O'clock to any minute",            needsTables:false },
  { id:'fractions',    label:'Fractions',       icon:'🍕', color:'linear-gradient(135deg,#db2777,#be185d)', modes:FRAC_MODES,     desc:'Identify, compare & calculate',     needsTables:false },
]

// ── Hash router ────────────────────────────────────────────────────────────────
function useHashRouter() {
  const getHash = () => window.location.hash.slice(1) || 'home'
  const [route, setRoute] = useState(getHash)
  useEffect(() => {
    const h = () => setRoute(getHash())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const go = path => { window.location.hash = path === 'home' ? '' : path }
  return { route, go }
}

// ── Storage ────────────────────────────────────────────────────────────────────
function loadStorage() { try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}}catch{return{}} }
function saveStorage(d){ localStorage.setItem(STORAGE_KEY,JSON.stringify(d)) }
function addScoreToHistory(mode,score){
  const s=loadStorage(), h=s.scoreHistory||{}
  const entry={score,date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
  const updated=[...(h[mode]||[]),entry].sort((a,b)=>b.score-a.score).slice(0,TOP_N)
  saveStorage({...s,scoreHistory:{...h,[mode]:updated}})
  return updated[0].score===score&&updated[0]===entry
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function shuffle(arr){
  const a=[...arr]
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a
}

// ── Times table questions ──────────────────────────────────────────────────────
function generateTimesQuestion(table,mode){
  const b=Math.floor(Math.random()*12)+1,p=table*b
  let m=mode
  if(m==='mixed')m=['times','division','missing'][Math.floor(Math.random()*3)]
  if(m==='times')  {const[x,y]=Math.random()>.5?[table,b]:[b,table];return{text:`${x} × ${y} = ?`,answer:p}}
  if(m==='division'){return{text:`${p} ÷ ${table} = ?`,answer:b}}
  const[x,y]=Math.random()>.5?[table,b]:[b,table];return{text:`${x} × ? = ${p}`,answer:y}
}
function generateTimesOptions(answer){
  const o=new Set([answer])
  for(const n of shuffle([answer-2,answer-1,answer+1,answer+2,answer-3,answer+3,answer*2,Math.max(1,answer-4)])){if(n>0&&n!==answer)o.add(n);if(o.size===4)break}
  while(o.size<4)o.add(Math.floor(Math.random()*120)+1)
  return shuffle([...o])
}

// ── Rounding questions ─────────────────────────────────────────────────────────
function generateRoundingQuestion(mode){
  if(mode==='round10')  {let n;do{n=Math.floor(Math.random()*89)+11}while(n%10===0);  return{text:`Round ${n} to the nearest 10`,answer:Math.round(n/10)*10}}
  if(mode==='round100') {let n;do{n=Math.floor(Math.random()*899)+101}while(n%100===0);return{text:`Round ${n} to the nearest 100`,answer:Math.round(n/100)*100}}
  let n;do{n=Math.floor(Math.random()*8999)+1001}while(n%1000===0)
  return{text:`Round ${n.toLocaleString()} to the nearest 1,000`,answer:Math.round(n/1000)*1000}
}
function generateRoundingOptions(answer,mode){
  const u=mode==='round10'?10:mode==='round100'?100:1000
  const o=new Set([answer])
  for(const x of shuffle([1,2,3,-1,-2,-3])){const n=answer+x*u;if(n>=0&&n!==answer)o.add(n);if(o.size===4)break}
  while(o.size<4){const n=answer+(Math.floor(Math.random()*6)+1)*u*(Math.random()>.5?1:-1);if(n>=0)o.add(n)}
  return shuffle([...o])
}

// ── Number line questions ──────────────────────────────────────────────────────
function generateNLQuestion(mode){
  const{min,max,ticks,step,inputType}=NL_CONFIGS[mode]
  const isRead=Math.random()>.5
  if(isRead){
    const pool=step===1?Array.from({length:max-min-1},(_,i)=>min+i+1).filter(v=>!ticks.includes(v)):Array.from({length:(max-min)/step-1},(_,i)=>min+(i+1)*step).filter(v=>!ticks.includes(v))
    const value=pool[Math.floor(Math.random()*pool.length)]
    return{type:'read',inputType,text:'What number is the arrow pointing to?',arrowAt:value,answer:value}
  }
  const range=max-min
  let target=step===1?min+Math.floor(Math.random()*(range+1)):min+Math.floor(Math.random()*(range/step+1))*step
  target=Math.max(min,Math.min(max,target))
  const ss=range/4,ts=Math.min(3,Math.floor((target-min)/ss))
  const positions=[]
  for(let s=0;s<4;s++){
    if(s===ts){positions.push(target)}
    else{
      const sMin=min+s*ss,sMax=min+(s+1)*ss
      let v=step===1?Math.round(sMin+Math.random()*(sMax-sMin)):Math.round((sMin+Math.random()*(sMax-sMin))/step)*step
      v=Math.max(min,Math.min(max,v))
      while(positions.includes(v))v=v===max?v-step:v+step
      positions.push(v)
    }
  }
  const sorted=[...new Set(positions)].sort((a,b)=>a-b).slice(0,4)
  const letters=['A','B','C','D']
  const optionPositions=sorted.map((v,i)=>({value:v,letter:letters[i]}))
  const correctLetter=optionPositions.find(o=>o.value===target)?.letter||'A'
  return{type:'place',inputType:'choice',text:`Where does ${target.toLocaleString()} go?`,optionPositions,answer:correctLetter}
}
function generateNLReadOptions(value,mode){
  const{min,max,step}=NL_CONFIGS[mode]
  const o=new Set([value])
  for(const x of shuffle([-3,-2,-1,1,2,3,4,-4])){const n=value+x*step;if(n>=min&&n<=max&&n!==value)o.add(n);if(o.size===4)break}
  while(o.size<4){const n=value+(Math.floor(Math.random()*5)+1)*step*(Math.random()>.5?1:-1);if(n>=min&&n<=max)o.add(n)}
  return shuffle([...o])
}

// ── Time questions ─────────────────────────────────────────────────────────────
function timeToStr(h,m,mode){
  if(mode==='time_any')return`${h}:${String(m).padStart(2,'0')}`
  if(m===0) return`${h} o'clock`
  if(m===30)return`Half past ${h}`
  if(m===15)return`Quarter past ${h}`
  if(m===45)return`Quarter to ${h===12?1:h+1}`
  if(m<30)  return`${m} past ${h}`
  return`${60-m} to ${h===12?1:h+1}`
}
function randomTime(mode){
  const h=Math.floor(Math.random()*12)+1
  let m
  if(mode==='time_oclock')  m=Math.random()>.5?0:30
  else if(mode==='time_quarter')m=[0,15,30,45][Math.floor(Math.random()*4)]
  else if(mode==='time_5min')   m=Math.floor(Math.random()*12)*5
  else                           m=Math.floor(Math.random()*60)
  return{h,m}
}
function generateTimeQuestion(mode){
  const{h,m}=randomTime(mode)
  return{visual:{type:'clock',hours:h,minutes:m},text:'What time does the clock show?',answer:timeToStr(h,m,mode)}
}
function generateTimeOptions(answer,mode){
  const o=new Set([answer])
  while(o.size<4){const{h,m}=randomTime(mode);const t=timeToStr(h,m,mode);if(t!==answer)o.add(t)}
  return shuffle([...o])
}

// ── Fraction questions ─────────────────────────────────────────────────────────
const FRAC_POOL=[[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5],[4,5],[1,6],[5,6],[1,8],[3,8],[5,8],[7,8],[1,10],[3,10],[7,10],[9,10]]
const KS1_FRACS=[[1,2],[1,4],[2,4],[3,4],[1,3],[2,3]]

function fStr(n,d){return`${n}/${d}`}

function generateFracQuestion(mode){
  if(mode==='frac_basic'){
    const[n,d]=KS1_FRACS[Math.floor(Math.random()*KS1_FRACS.length)]
    return{visual:{type:'frac_bar',n,d},text:'What fraction is shaded?',answer:fStr(n,d),isFrac:true}
  }
  if(mode==='frac_amounts'){
    const cfgs=[{d:2,pool:[4,6,8,10,12,14,16,18,20]},{d:3,pool:[6,9,12,15,18,21,24]},{d:4,pool:[4,8,12,16,20,24,28,32]},{d:5,pool:[5,10,15,20,25,30]},{d:10,pool:[10,20,30,40,50,60]}]
    const{d,pool}=cfgs[Math.floor(Math.random()*cfgs.length)]
    const n=Math.floor(Math.random()*(d-1))+1
    const amt=pool[Math.floor(Math.random()*pool.length)]
    return{text:`${fStr(n,d)} of ${amt} = ?`,answer:n*(amt/d),isFrac:false}
  }
  if(mode==='frac_equiv'){
    const pairs=[[1,2,2],[1,2,3],[1,2,4],[1,3,2],[1,3,3],[2,3,2],[2,3,3],[1,4,2],[3,4,2],[1,5,2],[2,5,2]]
    const[n,d,mult]=pairs[Math.floor(Math.random()*pairs.length)]
    return{text:`${fStr(n,d)} = ?/${d*mult}`,answer:n*mult,isFrac:false}
  }
  // frac_compare
  const chosen=shuffle([...FRAC_POOL]).slice(0,4)
  const sorted=[...chosen].sort((a,b)=>b[0]/b[1]-a[0]/a[1])
  const answer=fStr(sorted[0][0],sorted[0][1])
  const options=shuffle(chosen.map(([n,d])=>fStr(n,d)))
  return{text:'Which fraction is the largest?',answer,options,isFrac:true}
}
function generateFracOptions(answer,mode,preOptions){
  if(preOptions)return preOptions
  if(mode==='frac_basic'){
    const pool=KS1_FRACS.map(([n,d])=>fStr(n,d))
    const o=new Set([answer])
    for(const f of shuffle(pool)){if(f!==answer)o.add(f);if(o.size===4)break}
    return shuffle([...o])
  }
  const a=Number(answer),o=new Set([a])
  for(const x of shuffle([a-1,a+1,a-2,a+2,a*2,Math.max(1,a-3)])){if(x>0&&x!==a)o.add(x);if(o.size===4)break}
  while(o.size<4)o.add(a+Math.floor(Math.random()*5)+1)
  return shuffle([...o])
}

// ── Rating ─────────────────────────────────────────────────────────────────────
function getRating(score){
  if(score>=20)return{emoji:'🏆',title:'Maths Champion!',    msg:'Absolutely brilliant!'}
  if(score>=15)return{emoji:'⭐',title:'Super Star!',         msg:'Amazing work!'}
  if(score>=10)return{emoji:'😊',title:'Great Job!',          msg:"You're getting really good!"}
  if(score>=5) return{emoji:'👍',title:'Good Effort!',        msg:'Keep practising!'}
  return            {emoji:'💪',title:'Keep Going!',          msg:'Practice makes perfect!'}
}

// ── Visual components ──────────────────────────────────────────────────────────
function ClockFace({hours,minutes}){
  const CX=80,CY=80,R=72
  const pt=(a,len)=>({x:CX+len*Math.sin(a),y:CY-len*Math.cos(a)})
  const hAngle=((hours%12)+minutes/60)/12*2*Math.PI
  const mAngle=minutes/60*2*Math.PI
  const hTip=pt(hAngle,44),mTip=pt(mAngle,62)
  return(
    <svg viewBox="0 0 160 160" width="150" height="150" style={{display:'block',margin:'0 auto'}}>
      <circle cx={CX} cy={CY} r={R} fill="#faf5ff" stroke="#4f46e5" strokeWidth="4"/>
      {Array.from({length:60},(_,i)=>{
        const a=i/60*2*Math.PI,isH=i%5===0
        const p1=pt(a,R-(isH?12:5)),p2=pt(a,R-2)
        return<line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={isH?'#4f46e5':'#c4b5fd'} strokeWidth={isH?2.5:1}/>
      })}
      {[12,1,2,3,4,5,6,7,8,9,10,11].map((n,i)=>{
        const p=pt(i/12*2*Math.PI,R-22)
        return<text key={n} x={p.x} y={p.y+4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1f2937" fontFamily="sans-serif">{n}</text>
      })}
      <line x1={CX} y1={CY} x2={hTip.x} y2={hTip.y} stroke="#1f2937" strokeWidth="6" strokeLinecap="round"/>
      <line x1={CX} y1={CY} x2={mTip.x} y2={mTip.y} stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx={CX} cy={CY} r="5" fill="#7c3aed"/>
    </svg>
  )
}

function FractionBar({n,d}){
  const W=220,H=44,pw=W/d
  return(
    <svg viewBox={`0 0 ${W+4} ${H+4}`} width="100%" style={{maxWidth:260,display:'block',margin:'0 auto'}}>
      <rect x="1" y="1" width={W+2} height={H+2} rx="6" fill="#ede9fe" stroke="#4f46e5" strokeWidth="2"/>
      {Array.from({length:d},(_,i)=>(
        <g key={i}>
          {i<n&&<rect x={i*pw+2} y={2} width={pw-1} height={H} fill="#7c3aed" rx={i===0?4:0}/>}
          {i>0&&<line x1={i*pw+2} y1={2} x2={i*pw+2} y2={H+2} stroke="#4f46e5" strokeWidth="1.5"/>}
        </g>
      ))}
    </svg>
  )
}

function FracText({val}){
  const s=String(val)
  if(!s.includes('/'))return<>{s}</>
  const[n,d]=s.split('/')
  return<span className="frac-display"><span className="frac-n">{n}</span><span className="frac-line"/><span className="frac-d">{d}</span></span>
}

// ── Top Scores Panel ───────────────────────────────────────────────────────────
function TopScoresPanel({onClose, filterModes}){
  const{scoreHistory={}}=loadStorage()
  const modesToShow = filterModes || ALL_MODES
  const hasAny=modesToShow.some(m=>scoreHistory[m.id]?.length)
  const renderSection=(modes,title)=>{
    const w=modes.filter(m=>scoreHistory[m.id]?.length);if(!w.length)return null
    return(<>
      <div className="top-scores-section-title">{title}</div>
      {w.map(m=>(
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
    </>)
  }
  return(
    <div className="top-scores-panel">
      <div className="top-scores-header">
        <h3 className="top-scores-title">🏆 Top Scores</h3>
        <button className="tiny-btn" onClick={onClose}>✕ Close</button>
      </div>
      {!hasAny?<p style={{color:'#9ca3af',fontSize:'0.9rem',textAlign:'center',padding:'16px 0'}}>No scores yet — play a game!</p>
        :<>{
          filterModes
            ? renderSection(filterModes, '')
            : <>{renderSection(TIMES_MODES,'✖️ Times Tables')}{renderSection(ROUNDING_MODES,'🎯 Rounding')}{renderSection(NL_MODES,'📏 Number Lines')}{renderSection(TIME_MODES,'🕐 Telling the Time')}{renderSection(FRAC_MODES,'🍕 Fractions')}</>
        }</>
      }
    </div>
  )
}

// ── Category Menu (Home) ───────────────────────────────────────────────────────
function CategoryMenu({ onSelect, onShowScores }) {
  const { scoreHistory = {} } = loadStorage()
  return (
    <div className="screen">
      <h1 className="home-title">Maths Dash!</h1>
      <p className="home-subtitle">Fast-fire maths practice for kids</p>
      <div className="category-grid">
        {CATEGORIES.map(cat => {
          const best = cat.modes.map(m => scoreHistory[m.id]?.[0]?.score || 0).filter(s => s > 0)
          const top = best.length ? Math.max(...best) : null
          return (
            <button key={cat.id} className="cat-card" style={{ background: cat.color }} onClick={() => onSelect(cat.id)}>
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-label">{cat.label}</span>
              <span className="cat-desc">{cat.desc}</span>
              {top && <span className="cat-best">🏅 Best: {top}</span>}
            </button>
          )
        })}
      </div>
      <button className="tiny-btn scores-toggle-btn" onClick={onShowScores}>🏆 View Top Scores</button>
    </div>
  )
}

// ── Category Screen ────────────────────────────────────────────────────────────
function CategoryScreen({ category, onStart, onBack }) {
  const stored = loadStorage()
  const [selectedMode, setSelectedMode] = useState(() => {
    const last = stored.lastMode
    return category.modes.find(m => m.id === last)?.id || category.modes[0].id
  })
  const [selectedTables, setSelectedTables] = useState(() =>
    new Set(Array.isArray(stored.lastTables) && stored.lastTables.length ? stored.lastTables : [])
  )
  const [timed, setTimed] = useState(true)
  const [showScores, setShowScores] = useState(false)

  const isNL = NL_IDS.has(selectedMode)
  const needsTables = category.needsTables && !NO_TABLES.has(selectedMode)
  const canStart = !needsTables || selectedTables.size > 0

  const sh = stored.scoreHistory || {}
  const best = Object.fromEntries(category.modes.map(m => [m.id, sh[m.id]?.[0]?.score || 0]))
  const hasScores = category.modes.some(m => best[m.id] > 0)

  const toggleTable = t => setSelectedTables(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })

  const handleStart = () => {
    const tables = needsTables ? [...selectedTables] : []
    saveStorage({ ...loadStorage(), lastTables: tables, lastMode: selectedMode })
    onStart(tables, selectedMode, timed)
  }

  const cols = category.modes.length === 3 ? 'repeat(3,1fr)' : undefined

  return (
    <div className="screen">
      <div className="screen-nav">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2 className="screen-title" style={{ background: category.color, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          {category.icon} {category.label}
        </h2>
        <div style={{ width: 60 }} />
      </div>

      <p className="section-label">Choose a game type</p>
      <div className="mode-grid" style={cols ? { gridTemplateColumns: cols } : undefined}>
        {category.modes.map(m => (
          <button key={m.id} className={`mode-btn${selectedMode === m.id ? ' selected' : ''}`} onClick={() => setSelectedMode(m.id)}>
            <span className="mode-icon">{m.icon}</span>{m.label}
            <br /><small style={{ fontWeight: 400, opacity: 0.8 }}>{m.desc}</small>
            {best[m.id] > 0 && <span className="mode-best">🏅 Best: {best[m.id]}</span>}
          </button>
        ))}
      </div>

      {needsTables && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'16px 0 10px' }}>
            <p className="section-label" style={{ margin: 0 }}>Choose your times tables</p>
            <div style={{ display:'flex', gap: 8 }}>
              <button className="tiny-btn" onClick={() => setSelectedTables(new Set(TABLES))}>All</button>
              <button className="tiny-btn" onClick={() => setSelectedTables(new Set())}>Clear</button>
            </div>
          </div>
          <div className="table-grid">
            {TABLES.map(t => (
              <button key={t} className={`table-btn${selectedTables.has(t) ? ' selected' : ''}`} onClick={() => toggleTable(t)}>{t}×</button>
            ))}
          </div>
        </>
      )}

      {isNL && (
        <div className="timed-toggle">
          <span className="section-label" style={{ margin: 0 }}>Mode</span>
          <div className="toggle-btns">
            <button className={`toggle-opt${timed ? ' active' : ''}`} onClick={() => setTimed(true)}>⏱ Timed (60s)</button>
            <button className={`toggle-opt${!timed ? ' active' : ''}`} onClick={() => setTimed(false)}>∞ Untimed</button>
          </div>
        </div>
      )}

      <button className="start-btn" disabled={!canStart} onClick={handleStart}>▶ Start!</button>
      {!canStart && <p style={{ marginTop: 12, color:'#9ca3af', fontSize:'0.9rem' }}>Pick at least one times table to begin</p>}

      {hasScores && (
        <div className="best-scores-section">
          <button className="tiny-btn scores-toggle-btn" onClick={() => setShowScores(s => !s)}>
            🏆 {showScores ? 'Hide Top Scores' : 'View Top Scores'}
          </button>
          {showScores && <TopScoresPanel onClose={() => setShowScores(false)} filterModes={category.modes} />}
        </div>
      )}
    </div>
  )
}

// ── Game Screen (times, rounding, time, fractions) ─────────────────────────────
function GameScreen({table,mode,onEnd}){
  const[question,setQuestion]=useState(null)
  const[options,setOptions]=useState([])
  const[score,setScore]=useState(0)
  const[wrong,setWrong]=useState(0)
  const[timeLeft,setTimeLeft]=useState(GAME_DURATION)
  const[feedback,setFeedback]=useState(null)
  const[streak,setStreak]=useState(0)
  const[bestStreak,setBestStreak]=useState(0)
  const streakRef=useRef(0),lockedRef=useRef(false),endedRef=useRef(false)

  const nextQuestion=useCallback(()=>{
    let q,opts
    if(ROUNDING_IDS.has(mode)){ q=generateRoundingQuestion(mode); opts=generateRoundingOptions(q.answer,mode) }
    else if(TIME_IDS.has(mode)){ q=generateTimeQuestion(mode); opts=generateTimeOptions(q.answer,mode) }
    else if(FRAC_IDS.has(mode)){ q=generateFracQuestion(mode); opts=generateFracOptions(q.answer,mode,q.options) }
    else{ const t=table[Math.floor(Math.random()*table.length)]; q=generateTimesQuestion(t,mode); opts=generateTimesOptions(q.answer) }
    setQuestion(q);setOptions(opts);setFeedback(null);lockedRef.current=false
  },[table,mode])

  useEffect(()=>{nextQuestion()},[nextQuestion])
  useEffect(()=>{if(timeLeft<=0)return;const id=setInterval(()=>setTimeLeft(t=>t-1),1000);return()=>clearInterval(id)},[timeLeft])
  useEffect(()=>{if(timeLeft===0&&!endedRef.current){endedRef.current=true;onEnd({score,wrong,bestStreak:Math.max(bestStreak,streakRef.current)})}})

  const handleAnswer=(val,idx)=>{
    if(lockedRef.current||timeLeft===0)return;lockedRef.current=true
    const correct=String(val)===String(question.answer)
    setFeedback({idx,correct})
    if(correct){streakRef.current+=1;setStreak(streakRef.current);setBestStreak(p=>Math.max(p,streakRef.current));setScore(s=>s+1)}
    else{streakRef.current=0;setStreak(0);setWrong(w=>w+1)}
    setTimeout(()=>nextQuestion(),420)
  }

  if(!question)return null
  const hasVisual=!!question.visual
  const isFrac=question.isFrac

  return(
    <div className="screen">
      <div className="game-header">
        <div className="stat-box score-box"><div className="stat-label">Score</div><div className="stat-value">{score}</div></div>
        <div className={`stat-box timer-box${timeLeft<=10?' danger':''}`}><div className="stat-label">Time</div><div className="stat-value">{timeLeft}s</div></div>
        <div className="stat-box"><div className="stat-label">Wrong</div><div className="stat-value" style={{color:'#ef4444'}}>{wrong}</div></div>
      </div>
      <div className="progress-bar"><div className="progress-fill" style={{width:`${(timeLeft/GAME_DURATION)*100}%`}}/></div>

      {hasVisual&&(
        <div className="visual-container">
          {question.visual.type==='clock'    &&<ClockFace hours={question.visual.hours} minutes={question.visual.minutes}/>}
          {question.visual.type==='frac_bar' &&<FractionBar n={question.visual.n} d={question.visual.d}/>}
        </div>
      )}

      <div className="question-area">
        <div className={hasVisual?'question-text-sm':'question-text'}>{question.text}</div>
      </div>

      <div className="answers-grid">
        {options.map((opt,i)=>(
          <button key={i} className={`answer-btn${feedback?.idx===i?(feedback.correct?' correct':' wrong'):''}`} onClick={()=>handleAnswer(opt,i)}>
            {isFrac?<FracText val={opt}/>:typeof opt==='number'?opt.toLocaleString():opt}
          </button>
        ))}
      </div>
      <div className="streak-bar">{streak>=3?`🔥 ${streak} in a row!`:streak>=2?'⚡ Keep it up!':' '}</div>
    </div>
  )
}

// ── NumberPad ──────────────────────────────────────────────────────────────────
function NumberPad({value,onChange,onSubmit}){
  const rows=[['1','2','3'],['4','5','6'],['7','8','9'],['⌫','0','✓']]
  const handle=k=>{if(k==='⌫')onChange(value.slice(0,-1));else if(k==='✓'){if(value)onSubmit()}else if(value.length<5)onChange(value+k)}
  return(
    <div className="number-pad">
      <div className="pad-display">{value||<span style={{opacity:0.3}}>?</span>}</div>
      {rows.map((row,i)=>(
        <div key={i} className="pad-row">
          {row.map(k=><button key={k} className={`pad-key${k==='✓'?' pad-submit':k==='⌫'?' pad-delete':''}`} onClick={()=>handle(k)}>{k}</button>)}
        </div>
      ))}
    </div>
  )
}

// ── Number Line SVG ────────────────────────────────────────────────────────────
function NLLineSVG({ cfg, question }) {
  const { min, max, ticks } = cfg
  const x1 = 22, x2 = 296, lineY = 52
  const toX = v => x1 + ((v - min) / (max - min)) * (x2 - x1)

  return (
    <svg viewBox="0 0 320 75" width="100%" style={{display:'block', maxWidth:500, margin:'0 auto'}}>
      <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke="#4f46e5" strokeWidth="3" strokeLinecap="round"/>
      <polygon points={`${x2+9},${lineY} ${x2+1},${lineY-5} ${x2+1},${lineY+5}`} fill="#4f46e5"/>
      {ticks.map(t => {
        const x = toX(t)
        return (
          <g key={t}>
            <line x1={x} y1={lineY-7} x2={x} y2={lineY+7} stroke="#4f46e5" strokeWidth="2"/>
            <text x={x} y={lineY+19} textAnchor="middle" fontSize="8" fill="#4b5563" fontFamily="sans-serif">{t.toLocaleString()}</text>
          </g>
        )
      })}
      {question.type === 'read' && (() => {
        const x = toX(question.arrowAt)
        return (
          <g>
            <text x={x} y={lineY-28} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#7c3aed" fontFamily="sans-serif">?</text>
            <line x1={x} y1={lineY-22} x2={x} y2={lineY-9} stroke="#7c3aed" strokeWidth="2.5"/>
            <polygon points={`${x},${lineY-7} ${x-5},${lineY-17} ${x+5},${lineY-17}`} fill="#7c3aed"/>
          </g>
        )
      })()}
      {question.type === 'place' && question.optionPositions.map(({ value, letter }) => {
        const x = toX(value)
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

// ── Number Line Game Screen ────────────────────────────────────────────────────
function NumberLineGameScreen({mode,timed,onEnd}){
  const cfg=NL_CONFIGS[mode]
  const[question,setQuestion]=useState(null)
  const[choiceOpts,setChoiceOpts]=useState([])
  const[padValue,setPadValue]=useState('')
  const[score,setScore]=useState(0)
  const[wrong,setWrong]=useState(0)
  const[timeLeft,setTimeLeft]=useState(GAME_DURATION)
  const[feedback,setFeedback]=useState(null)
  const[streak,setStreak]=useState(0)
  const[bestStreak,setBestStreak]=useState(0)
  const streakRef=useRef(0),lockedRef=useRef(false),endedRef=useRef(false)

  const nextQuestion=useCallback(()=>{
    const q=generateNLQuestion(mode)
    setQuestion(q)
    if(q.type==='read'&&q.inputType==='choice')setChoiceOpts(generateNLReadOptions(q.answer,mode))
    else if(q.type==='place')setChoiceOpts(q.optionPositions.map(o=>o.letter))
    setPadValue('');setFeedback(null);lockedRef.current=false
  },[mode])

  useEffect(()=>{nextQuestion()},[nextQuestion])
  useEffect(()=>{if(!timed||timeLeft<=0)return;const id=setInterval(()=>setTimeLeft(t=>t-1),1000);return()=>clearInterval(id)},[timeLeft,timed])
  useEffect(()=>{if(timed&&timeLeft===0&&!endedRef.current){endedRef.current=true;onEnd({score,wrong,bestStreak:Math.max(bestStreak,streakRef.current)})}})

  const handleAnswer=val=>{
    if(lockedRef.current)return;if(timed&&timeLeft===0)return
    lockedRef.current=true
    const correct=String(val)===String(question.answer)
    setFeedback({correct,picked:String(val),shownAnswer:String(question.answer)})
    if(correct){streakRef.current+=1;setStreak(streakRef.current);setBestStreak(p=>Math.max(p,streakRef.current));setScore(s=>s+1)}
    else{streakRef.current=0;setStreak(0);setWrong(w=>w+1)}
    setTimeout(()=>nextQuestion(),600)
  }

  if(!question)return null

  return(
    <div className="screen">
      <div className="game-header">
        <div className="stat-box score-box"><div className="stat-label">Score</div><div className="stat-value">{score}</div></div>
        {timed
          ?<div className={`stat-box timer-box${timeLeft<=10?' danger':''}`}><div className="stat-label">Time</div><div className="stat-value">{timeLeft}s</div></div>
          :<div className="stat-box"><div className="stat-label">Range</div><div className="stat-value" style={{fontSize:'0.9rem'}}>{cfg.min}–{cfg.max.toLocaleString()}</div></div>
        }
        <div className="stat-box"><div className="stat-label">Wrong</div><div className="stat-value" style={{color:'#ef4444'}}>{wrong}</div></div>
      </div>
      {timed&&<div className="progress-bar"><div className="progress-fill" style={{width:`${(timeLeft/GAME_DURATION)*100}%`}}/></div>}
      <div className="nl-question">{question.text}</div>
      <div className="nl-line-wrap">
        <NLLineSVG cfg={cfg} question={question}/>
      </div>
      {feedback&&<div className={`nl-feedback ${feedback.correct?'nl-correct':'nl-wrong'}`}>{feedback.correct?'✓ Correct!':`✗ Answer: ${question.type==='read'?Number(feedback.shownAnswer).toLocaleString():feedback.shownAnswer}`}</div>}
      {question.inputType==='choice'||question.type==='place'
        ?<div className={`answers-grid${question.type==='place'?' place-grid':''}`}>
            {choiceOpts.map((opt,i)=>(
              <button key={i} disabled={!!feedback}
                className={`answer-btn${feedback?(String(opt)===feedback.shownAnswer?' correct':String(opt)===feedback.picked&&!feedback.correct?' wrong':''):''}`}
                onClick={()=>handleAnswer(opt)}>
                {question.type==='read'?Number(opt).toLocaleString():opt}
              </button>
            ))}
          </div>
        :<NumberPad value={padValue} onChange={setPadValue} onSubmit={()=>handleAnswer(parseInt(padValue,10))}/>
      }
      <div className="streak-bar">{streak>=3?`🔥 ${streak} in a row!`:streak>=2?'⚡ Keep it up!':' '}</div>
      {!timed&&<button className="home-btn" style={{marginTop:8}} onClick={()=>onEnd({score,wrong,bestStreak:Math.max(bestStreak,streakRef.current)})}>🏁 Finish</button>}
    </div>
  )
}

// ── Results Screen ─────────────────────────────────────────────────────────────
function ResultsScreen({result,mode,onPlayAgain,onHome}){
  const rating=getRating(result.score)
  const total=result.score+result.wrong
  const accuracy=total>0?Math.round((result.score/total)*100):0
  const[isNewBest,setIsNewBest]=useState(false)
  const[prevBest,setPrevBest]=useState(0)
  useEffect(()=>{
    const{scoreHistory={}}=loadStorage()
    const prev=scoreHistory[mode]?.[0]?.score||0
    setPrevBest(prev)
    setIsNewBest(addScoreToHistory(mode,result.score)&&result.score>=prev)
  },[])
  return(
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
      {prevBest>0&&!isNewBest&&<p style={{color:'#6b7280',fontSize:'0.9rem',marginBottom:20}}>🏅 Your best for this mode: <strong>{prevBest}</strong></p>}
      <div className="results-actions">
        <button className="play-again-btn" onClick={onPlayAgain}>🔁 Play Again</button>
        <button className="home-btn" onClick={onHome}>🏠 Home</button>
      </div>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App(){
  const { route, go } = useHashRouter()
  const [gameScreen, setGameScreen] = useState(null) // null | 'game' | 'results'
  const [config, setConfig]         = useState(null)
  const [result, setResult]         = useState(null)
  const [showAllScores, setShowAllScores] = useState(false)

  // If hash changes while in game/results, abandon and follow the hash
  useEffect(() => {
    if (gameScreen) { setGameScreen(null); setConfig(null); setResult(null) }
  }, [route]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = (tables, mode, timed) => {
    setConfig({ table: tables, mode, timed })
    setGameScreen('game')
    go('game')
  }

  const handleEnd = r => { setResult(r); setGameScreen('results'); go('results') }

  const handleHome = () => {
    setGameScreen(null); setConfig(null); setResult(null)
    go('home')
  }

  const handlePlayAgain = () => { setGameScreen('game'); go('game') }

  // Determine content
  let content
  if (gameScreen === 'game') {
    const key = JSON.stringify(config) + Date.now()
    content = NL_IDS.has(config.mode)
      ? <NumberLineGameScreen key={key} mode={config.mode} timed={config.timed} onEnd={handleEnd}/>
      : <GameScreen key={key} table={config.table} mode={config.mode} onEnd={handleEnd}/>
  } else if (gameScreen === 'results') {
    content = <ResultsScreen result={result} mode={config.mode} onPlayAgain={handlePlayAgain} onHome={handleHome}/>
  } else {
    const cat = CATEGORIES.find(c => c.id === route)
    if (cat) {
      content = <CategoryScreen category={cat} onStart={handleStart} onBack={() => go('home')}/>
    } else {
      content = <CategoryMenu onSelect={id => go(id)} onShowScores={() => setShowAllScores(true)}/>
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%' }}>
      <div className="game-logo-bar">
        <img src="/logo.png" alt="Maths Dash" className="game-logo-sm"/>
      </div>
      {content}
      {showAllScores && (
        <div className="scores-overlay" onClick={() => setShowAllScores(false)}>
          <div className="scores-overlay-inner" onClick={e => e.stopPropagation()}>
            <TopScoresPanel onClose={() => setShowAllScores(false)}/>
          </div>
        </div>
      )}
      <footer className="footer">
        <a href="https://ko-fi.com/activlearn" target="_blank" rel="noopener noreferrer" className="kofi-btn kofi-btn-sm">☕ Support us on Ko-fi</a>
        <div style={{ marginTop: 6 }}>© 2026 Activ Ops Solutions Ltd. All rights reserved.</div>
      </footer>
    </div>
  )
}
