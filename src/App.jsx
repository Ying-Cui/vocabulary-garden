import { useCallback, useMemo, useState } from 'react'
import { WORDS } from './data.js'

const STORAGE_KEY = 'kotoba-garden-v1'
const BATCH_SIZE = 20

const icons = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/></>,
  card: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h6"/></>,
  quiz: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01"/></>,
  write: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></>,
  sound: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8"/></>,
  leaf: <><path d="M12 21c0-7 1-12 7-17 0 7-2 13-7 17Z"/><path d="M12 21C9 14 7 9 3 6c0 7 3 12 9 15Z"/><path d="M12 21V9"/></>
}

function Icon({ name, size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function normalize(value) {
  return value.trim().toLocaleLowerCase().replace(/[?.!]/g, '').replace(/\s+/g, ' ')
}

function Header() {
  return <header className="header"><div className="brand"><Icon name="leaf" size={31}/><span>ことばの庭</span></div><div className="header-note">全 {WORDS.length} 語</div></header>
}

function Nav({ screen, onChange }) {
  const items = [['home','ホーム'],['card','カード'],['quiz','クイズ'],['write','入力テスト']]
  return <nav className="nav" aria-label="メインメニュー">{items.map(([id,label]) => <button key={id} className={screen===id?'active':''} onClick={()=>onChange(id)}><Icon name={id}/><span>{label}</span></button>)}</nav>
}

function ProgressBar({ value, max }) {
  return <div className="progress-track" aria-label={`${max}問中${value}問`}><span style={{width:`${max ? value/max*100 : 0}%`}} /></div>
}

function App() {
  const [screen, setScreen] = useState('home')
  const [progress, setProgress] = useState(loadProgress)
  const [batch, setBatch] = useState(() => shuffle(WORDS).slice(0, BATCH_SIZE))

  const saveResult = useCallback((word, correct) => {
    setProgress(prev => {
      const current = prev[word.id] || { seen: 0, correct: 0, wrong: 0 }
      const next = { ...prev, [word.id]: { seen: current.seen + 1, correct: current.correct + (correct ? 1 : 0), wrong: current.wrong + (correct ? 0 : 1) } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const weakWords = useMemo(() => WORDS.filter(w => (progress[w.id]?.wrong || 0) > 0).sort((a,b) => (progress[b.id].wrong-progress[b.id].correct)-(progress[a.id].wrong-progress[a.id].correct)), [progress])
  const mastered = useMemo(() => Object.values(progress).filter(v => v.correct >= 2 && v.correct > v.wrong).length, [progress])
  const studied = Object.keys(progress).length

  const start = (target, weakOnly=false) => {
    const pool = weakOnly && weakWords.length ? weakWords : WORDS
    setBatch(shuffle(pool).slice(0, Math.min(BATCH_SIZE, pool.length)))
    setScreen(target)
  }

  const content = screen === 'home' ? <Home {...{studied, mastered, weakWords, start, setScreen}} />
    : screen === 'card' ? <Cards words={batch} saveResult={saveResult} restart={()=>start('card')} />
    : screen === 'quiz' ? <Quiz words={batch} saveResult={saveResult} restart={()=>start('quiz')} />
    : screen === 'write' ? <Typing words={batch} saveResult={saveResult} restart={()=>start('write')} />
    : <WordList progress={progress} />

  return <div className="app-shell"><Header/><main>{content}</main><Nav screen={screen} onChange={id=>id==='home'?setScreen('home'):start(id)}/></div>
}

function Home({ studied, mastered, weakWords, start, setScreen }) {
  const pct = Math.round(studied / WORDS.length * 100)
  return <section className="home-layout">
    <div className="welcome">
      <h1>今日の20語</h1><p>毎回ランダムに選ばれた20語を、何回かに分けて学習できます。</p>
      <div className="home-actions">
        <button className="button primary" onClick={()=>start('card')}><Icon name="card"/>学習をはじめる<span>›</span></button>
        <button className="button secondary" onClick={()=>start('card',true)} disabled={!weakWords.length}><Icon name="refresh"/>苦手を復習<span>›</span></button>
        <button className="button secondary" onClick={()=>setScreen('list')}><Icon name="list"/>単語一覧<span>›</span></button>
      </div>
      <div className="record"><div className="record-head"><div><h2>学習の記録</h2><span>登録単語の進み具合</span></div><strong>{studied} <small>/ {WORDS.length}語</small></strong></div><ProgressBar value={studied} max={WORDS.length}/><div className="record-stats"><span><i className="dot green"/>覚えた <b>{mastered}語</b></span><span><i className="dot coral"/>苦手 <b>{weakWords.length}語</b></span></div></div>
    </div>
    <div className="home-preview"><div className="preview-title"><span>カードで学習</span><span>1 / 20</span></div><ProgressBar value={1} max={20}/><div className="demo-card"><span>表面</span><strong>mountain</strong><em/></div><p>カードをタップして意味を確認</p></div>
  </section>
}

function StudyHeader({ title, index, total }) {
  return <div className="study-head"><div><h1>{title}</h1><span>{index + 1} / {total}</span></div><ProgressBar value={index + 1} max={total}/></div>
}

function speak(word) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(word.replace('~',''))
  utterance.lang = 'en-US'; utterance.rate = .82; speechSynthesis.speak(utterance)
}

function Cards({ words, saveResult, restart }) {
  const [index, setIndex] = useState(0), [flipped, setFlipped] = useState(false), [done, setDone] = useState(false)
  const word = words[index]
  const answer = correct => { saveResult(word, correct); if(index === words.length-1) setDone(true); else {setIndex(index+1); setFlipped(false)} }
  if(done) return <Complete title="カード学習が終わりました" count={words.length} restart={restart}/>
  return <section className="study"><StudyHeader title="カードで学習" index={index} total={words.length}/><div className={`flashcard ${flipped?'flipped':''}`} role="button" tabIndex="0" onClick={()=>setFlipped(!flipped)} onKeyDown={e=>(e.key==='Enter'||e.key===' ')&&setFlipped(!flipped)} aria-label="カードをめくる"><span>{flipped?'意味':'表面'}</span><button className="sound" onClick={e=>{e.stopPropagation();speak(word.english)}} aria-label="発音を聞く"><Icon name="sound"/></button><strong>{flipped?word.japanese:word.english}</strong><em/><small>{flipped?'もう一度タップで英語へ':'タップして意味を見る'}</small></div><div className="answer-actions"><button className="button retry" onClick={()=>answer(false)}><Icon name="refresh"/>もう一度</button><button className="button primary" onClick={()=>answer(true)}><Icon name="check"/>覚えた</button></div></section>
}

function Quiz({ words, saveResult, restart }) {
  const [index,setIndex]=useState(0),[score,setScore]=useState(0),[selected,setSelected]=useState(null)
  const word=words[index]
  const options=useMemo(()=>shuffle([word,...shuffle(WORDS.filter(w=>w.id!==word.id)).slice(0,3)]),[word])
  const choose = option => { if(selected) return; setSelected(option.id); const ok=option.id===word.id; if(ok)setScore(score+1); saveResult(word,ok) }
  const next=()=>{if(index===words.length-1)setIndex(words.length);else{setIndex(index+1);setSelected(null)}}
  if(index===words.length)return <Complete title={`${score} / ${words.length} 問正解`} count={words.length} restart={restart}/>
  return <section className="study quiz"><StudyHeader title="4択クイズ" index={index} total={words.length}/><div className="question"><span>この英単語の意味は？</span><strong>{word.english}</strong><button className="sound" onClick={()=>speak(word.english)}><Icon name="sound"/></button></div><div className="options">{options.map((o,i)=><button key={o.id} onClick={()=>choose(o)} className={selected?(o.id===word.id?'correct':o.id===selected?'wrong':'dim'):''}><span>{String.fromCharCode(65+i)}</span>{o.japanese}</button>)}</div>{selected&&<button className="button primary next" onClick={next}>{index===words.length-1?'結果を見る':'次の問題'}</button>}</section>
}

function Typing({ words, saveResult, restart }) {
  const [index,setIndex]=useState(0),[value,setValue]=useState(''),[result,setResult]=useState(null),[score,setScore]=useState(0)
  const word=words[index]
  const check=e=>{e.preventDefault();if(result)return;const ok=normalize(value)===normalize(word.english);setResult(ok);if(ok)setScore(score+1);saveResult(word,ok)}
  const next=()=>{if(index===words.length-1)setIndex(words.length);else{setIndex(index+1);setValue('');setResult(null)}}
  if(index===words.length)return <Complete title={`${score} / ${words.length} 問正解`} count={words.length} restart={restart}/>
  return <section className="study typing"><StudyHeader title="入力テスト" index={index} total={words.length}/><form className="typing-card" onSubmit={check}><span>英語で入力してください</span><strong>{word.japanese}</strong><input autoFocus autoComplete="off" spellCheck="false" value={value} onChange={e=>setValue(e.target.value)} placeholder="答えを入力" aria-label="英単語の答え"/><button className="button primary" type="submit" disabled={!value.trim()||result!==null}>答え合わせ</button>{result!==null&&<div className={`feedback ${result?'ok':'ng'}`}><b>{result?'正解！':'もう一度覚えよう'}</b>{!result&&<span>正解：{word.english}</span>}<button type="button" className="button primary" onClick={next}>{index===words.length-1?'結果を見る':'次の問題'}</button></div>}</form></section>
}

function WordList({ progress }) {
  const [query,setQuery]=useState('')
  const shown=useMemo(()=>WORDS.filter(w=>(w.english+' '+w.japanese).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[query])
  return <section className="word-list"><div className="list-head"><div><h1>単語一覧</h1><p>重複を除いた {WORDS.length} 語</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="英語・日本語で検索"/></div><div className="rows">{shown.map(w=><div className="word-row" key={w.id}><button onClick={()=>speak(w.english)}><Icon name="sound" size={20}/></button><div><strong>{w.english}</strong><span>{w.japanese}</span></div>{progress[w.id]?.wrong>0&&<em>復習</em>}</div>)}</div></section>
}

function Complete({ title, count, restart }) {
  return <section className="complete"><div className="complete-mark"><Icon name="leaf" size={48}/></div><h1>{title}</h1><p>{count}語の学習記録を保存しました。</p><button className="button primary" onClick={restart}><Icon name="refresh"/>別の20語でもう一度</button></section>
}

export default App
