import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORDS, STORAGE_KEY } from './data.js'
import { acceptsAnswer, createOptions } from './study.js'
import { recordAnswer, summarizeProgress, wordStatus } from './progress.js'
import { photoSets, scopeWords } from './scopes.js'

const BATCH_SIZE = 20
const PHOTO_SETS = photoSets(WORDS)
const SCOPE_KEY = `${STORAGE_KEY}-scope`
const DIRECTION_KEY = `${STORAGE_KEY}-quiz-direction`
const STATUS_LABELS = { mastered: '覚えた', weak: '苦手', unseen: '未学習' }

function loadScope() {
  try {
    const saved = localStorage.getItem(SCOPE_KEY)
    return PHOTO_SETS.some(photo => photo.id === saved) ? saved : 'all'
  } catch { return 'all' }
}

function loadQuizDirection() {
  try { return localStorage.getItem(DIRECTION_KEY) === 'ja-en' ? 'ja-en' : 'en-ja' }
  catch { return 'en-ja' }
}

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
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch { return {} }
}

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}


function Header() {
  return <header className="header"><div className="brand"><Icon name="leaf" size={31}/><span>ことばの庭</span></div><div className="header-note">v2 · {WORDS.length}語・句</div></header>
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
  const [session, setSession] = useState(0)
  const [progress, setProgress] = useState(loadProgress)
  const [scope, setScope] = useState(loadScope)
  const [quizDirection, setQuizDirection] = useState(loadQuizDirection)
  const [storageError, setStorageError] = useState(false)
  const [batch, setBatch] = useState([])
  const [sessionInfo, setSessionInfo] = useState({ weakOnly: false, label: '' })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
      localStorage.setItem(SCOPE_KEY, scope)
      localStorage.setItem(DIRECTION_KEY, quizDirection)
      setStorageError(false)
    } catch { setStorageError(true) }
  }, [progress, scope, quizDirection])

  const saveResult = useCallback((word, correct) => {
    setProgress(previous => recordAnswer(previous, word, correct))
  }, [])
  const selectedWords = useMemo(() => scopeWords(WORDS, scope), [scope])
  const summary = useMemo(() => summarizeProgress(WORDS, progress), [progress])
  const weakWords = useMemo(() => selectedWords.filter(word => wordStatus(progress[word.id]) === 'weak'), [selectedWords, progress])
  const selectedPhoto = PHOTO_SETS.find(photo => photo.id === scope)
  const scopeLabel = selectedPhoto ? `${selectedPhoto.label} · ${selectedWords.length}語・句` : '全体からランダム20語'

  const start = (target, weakOnly = false) => {
    const pool = weakOnly ? weakWords : selectedWords
    const nextWords = scope === 'all' ? shuffle(pool).slice(0, BATCH_SIZE) : [...pool]
    setBatch(nextWords)
    setSessionInfo({ weakOnly, label: `${scopeLabel}${weakOnly ? ' · 苦手復習' : ''}` })
    setSession(value => value + 1)
    setScreen(target)
  }
  const restart = () => start(screen, sessionInfo.weakOnly)
  const changeQuizDirection = direction => {
    setQuizDirection(direction)
    start('quiz', sessionInfo.weakOnly)
  }
  const restartLabel = sessionInfo.weakOnly ? '残っている苦手をもう一度' : scope === 'all' ? '別の20語でもう一度' : '同じ写真でもう一度'
  const studyProps = { words: batch, saveResult, restart, restartLabel, label: sessionInfo.label }

  const content = screen === 'home' ? <Home {...{summary, weakWords, start, setScreen, scope, setScope, selectedPhoto, scopeLabel}} />
    : screen === 'list' ? <WordList progress={progress} words={selectedWords} label={scopeLabel} />
    : !batch.length ? <section className="complete"><Icon name="check" size={48}/><h1>この範囲に苦手な単語はありません</h1><p>学ぶ範囲を選んで、次の学習へ進みましょう。</p><button className="button primary" onClick={()=>setScreen('home')}>ホームへ戻る</button></section>
    : screen === 'card' ? <Cards key={session} {...studyProps} />
    : screen === 'quiz' ? <Quiz key={session} {...studyProps} direction={quizDirection} onDirectionChange={changeQuizDirection} />
    : <Typing key={session} {...studyProps} />

  return <div className="app-shell"><Header/><main>{storageError && <p className="storage-warning" role="alert">学習記録を端末に保存できません。ブラウザの保存設定をご確認ください。</p>}{content}</main><Nav screen={screen} onChange={id=>id==='home'?setScreen('home'):start(id)}/></div>
}

function Home({ summary, weakWords, start, setScreen, scope, setScope, selectedPhoto, scopeLabel }) {
  return <section className="home-layout">
    <div className="welcome">
      <h1>{selectedPhoto ? `${selectedPhoto.label}の${selectedPhoto.count}語` : '今日の20語'}</h1>
      <p className="edition-note">v2 · p.93–115 · 全200語・句</p>
      <div className="scope-picker">
        <label htmlFor="study-scope">学ぶ範囲</label>
        <select id="study-scope" value={scope} onChange={event=>setScope(event.target.value)}>
          <option value="all">全体からランダム20語</option>
          {PHOTO_SETS.map(photo=><option key={photo.id} value={photo.id}>{photo.label}：{photo.first} ～ {photo.last}（{photo.count}語）</option>)}
        </select>
        <p>{selectedPhoto ? `${selectedPhoto.filename} · p.${selectedPhoto.pages[0]}${selectedPhoto.pages.length > 1 ? `–${selectedPhoto.pages.at(-1)}` : ''}。写真の掲載順に学習します。` : 'ランダムな20語、または単語表の写真15枚から選べます。'}</p>
      </div>
      <div className="home-actions">
        <button className="button primary" onClick={()=>start('card')}><Icon name="card"/>学習をはじめる<span>›</span></button>
        <button className="button secondary" onClick={()=>start('card',true)} disabled={!weakWords.length}><Icon name="refresh"/>苦手を復習（{weakWords.length}語）<span>›</span></button>
        <button className="button secondary" onClick={()=>setScreen('list')}><Icon name="list"/>単語一覧<span>›</span></button>
      </div>
      <p className="scope-help">カード・クイズ・入力テストは、選んだ範囲から出題します。</p>
      <div className="record">
        <div className="record-head"><div><h2>全体の学習記録</h2><span>覚えた単語の割合</span></div><strong>{summary.mastered} <small>/ {WORDS.length}語</small></strong></div>
        <ProgressBar value={summary.mastered} max={WORDS.length}/>
        <div className="record-stats" aria-label="学習状況の内訳">
          {['mastered','weak','unseen'].map(status=><span key={status}><i className={`dot ${status}`}/>{STATUS_LABELS[status]}<b>{summary[status]}語</b></span>)}
        </div>
        <p className="record-total">{summary.mastered} ＋ {summary.weak} ＋ {summary.unseen} ＝ {WORDS.length}語</p>
        <p className="record-help">直近の回答が正解なら「覚えた」、不正解なら「苦手」。再入力は練習のため記録に加算しません。</p>
      </div>
    </div>
    <div className="home-preview"><div className="preview-title"><span>カードで学習</span><span>{selectedPhoto ? `${selectedPhoto.count}語` : '20語'}</span></div><p className="preview-scope">{scopeLabel}</p><div className="demo-card"><span>表面</span><strong>{selectedPhoto ? selectedPhoto.first : 'medicine'}</strong><em/></div><p>カードをタップして意味を確認</p></div>
  </section>
}

function StudyHeader({ title, index, total, label }) {
  return <div className="study-head"><p className="session-label">{label}</p><div><h1>{title}</h1><span>{index + 1} / {total}</span></div><ProgressBar value={index + 1} max={total}/></div>
}

function speak(word) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(word.replace('~',''))
  utterance.lang = 'en-US'; utterance.rate = .82; speechSynthesis.speak(utterance)
}

function Cards({ words, saveResult, restart, restartLabel, label }) {
  const [index, setIndex] = useState(0), [flipped, setFlipped] = useState(false), [done, setDone] = useState(false)
  const word = words[index]
  const answer = correct => { saveResult(word, correct); if(index === words.length-1) setDone(true); else {setIndex(index+1); setFlipped(false)} }
  if(done) return <Complete title="カード学習が終わりました" count={words.length} restart={restart} restartLabel={restartLabel}/>
  return <section className="study"><StudyHeader title="カードで学習" index={index} total={words.length} label={label}/><div className={`flashcard ${flipped?'flipped':''}`} role="button" tabIndex="0" onClick={()=>setFlipped(!flipped)} onKeyDown={e=>(e.key==='Enter'||e.key===' ')&&setFlipped(!flipped)} aria-label="カードをめくる"><span>{flipped?'意味':'表面'}</span><button className="sound" onClick={e=>{e.stopPropagation();speak(word.english)}} aria-label="発音を聞く"><Icon name="sound"/></button><strong>{flipped?word.japanese:word.english}</strong><em/><small>{flipped?'もう一度タップで英語へ':'タップして意味を見る'}</small></div><div className="answer-actions"><button className="button retry" onClick={()=>answer(false)}><Icon name="refresh"/>もう一度</button><button className="button primary" onClick={()=>answer(true)}><Icon name="check"/>覚えた</button></div></section>
}

function Quiz({ words, saveResult, restart, restartLabel, label, direction, onDirectionChange }) {
  const [index,setIndex]=useState(0),[score,setScore]=useState(0),[selected,setSelected]=useState(null)
  const answeredRef = useRef(false)
  const word=words[index]
  const reverse = direction === 'ja-en'
  const directionLabel = reverse ? '日本語 → 英語' : '英語 → 日本語'
  const options=useMemo(()=>word ? createOptions(word, WORDS) : [],[word])
  const choose = option => { if(answeredRef.current) return; answeredRef.current=true; setSelected(option.id); const ok=option.id===word.id; if(ok)setScore(previous=>previous+1); saveResult(word,ok) }
  const next=()=>{if(index===words.length-1)setIndex(words.length);else{setIndex(index+1);setSelected(null);answeredRef.current=false}}
  if(index===words.length)return <Complete title={`${score} / ${words.length} 問正解`} count={words.length} restart={restart} restartLabel={restartLabel} detail={directionLabel}/>
  return <section className={`study quiz ${reverse ? 'quiz-reverse' : ''}`}>
    <StudyHeader title="4択クイズ" index={index} total={words.length} label={label}/>
    <div className="quiz-direction">
      <label htmlFor="quiz-direction">クイズの向き</label>
      <select id="quiz-direction" value={direction} onChange={event=>onDirectionChange(event.target.value)}>
        <option value="en-ja">英語 → 日本語</option>
        <option value="ja-en">日本語 → 英語</option>
      </select>
      <small>切り替えると1問目から始まります。回答済みの記録は残ります。</small>
    </div>
    <div className="question">
      <span>{reverse ? 'この日本語に合う英語は？' : 'この英単語の意味は？'}</span>
      <strong lang={reverse ? 'ja' : 'en'}>{reverse ? word.japanese : word.english}</strong>
      {(!reverse || selected) && <button className="sound" onClick={()=>speak(word.english)} aria-label={reverse ? '正解の発音を聞く' : '発音を聞く'}><Icon name="sound"/></button>}
    </div>
    <div className="options">{options.map((option,i)=><button key={option.id} disabled={selected !== null} onClick={()=>choose(option)} className={selected?(option.id===word.id?'correct':option.id===selected?'wrong':'dim'):''}><span>{String.fromCharCode(65+i)}</span><b lang={reverse ? 'en' : 'ja'}>{reverse ? option.english : option.japanese}</b></button>)}</div>
    {selected && <>
      <p className={`quiz-feedback ${selected===word.id ? 'ok' : 'ng'}`} role="status">{selected===word.id ? '正解！' : 'もう一度覚えよう'}　正解：{reverse ? word.english : word.japanese}</p>
      <button className="button primary next" onClick={next}>{index===words.length-1?'結果を見る':'次の問題'}</button>
    </>}
  </section>
}

function Typing({ words, saveResult, restart, restartLabel, label }) {
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)
  const [firstResult, setFirstResult] = useState(null)
  const [score, setScore] = useState(0)
  const inputRef = useRef(null)
  const submittedRef = useRef(false)
  const word = words[index]
  const practice = firstResult !== null

  const check = event => {
    event.preventDefault()
    if (submittedRef.current || result !== null || !value.trim()) return
    submittedRef.current = true
    const correct = acceptsAnswer(value, word, WORDS)
    setResult(correct)
    if (firstResult === null) {
      setFirstResult(correct)
      if (correct) setScore(previous => previous + 1)
      saveResult(word, correct)
    }
  }
  const retry = () => {
    setValue('')
    setResult(null)
    submittedRef.current = false
    inputRef.current?.focus()
  }
  const next = () => {
    setIndex(previous => previous + 1)
    setValue('')
    setResult(null)
    setFirstResult(null)
    submittedRef.current = false
    inputRef.current?.focus()
  }

  if (!word) return <Complete title={`初回の結果：${score} / ${words.length} 問正解`} count={words.length} restart={restart} restartLabel={restartLabel}/>
  return <section className="study typing">
    <StudyHeader title="入力テスト" index={index} total={words.length} label={label}/>
    <form className="typing-card" onSubmit={check}>
      <span>{practice && result === null ? 'もう一度、英語で入力してみましょう' : '英語で入力してください'}</span>
      <strong>{word.japanese}</strong>
      <input ref={inputRef} autoFocus autoComplete="off" autoCapitalize="none" spellCheck="false" readOnly={result !== null} value={value} onChange={event=>setValue(event.target.value)} placeholder="答えを入力" aria-label="英単語の答え"/>
      <button className="button primary" type="submit" disabled={!value.trim() || result !== null}>答え合わせ</button>
      {practice && <p className="practice-note">再入力は練習です。初回の得点・学習記録は変わりません。</p>}
      {result !== null && <div className={`feedback ${result ? 'ok' : 'ng'}`} aria-live="polite">
        <b>{result ? '正解！' : 'もう一度覚えよう'}</b>
        {!result && <span>正解：{word.english}</span>}
        <button type="button" className="button secondary retry-input" onClick={retry}><Icon name="refresh"/>もう一度入力する</button>
        <button type="button" className="button primary" onClick={next}>{index === words.length - 1 ? '結果を見る' : '次の問題'}</button>
      </div>}
    </form>
  </section>
}

function WordList({ progress, words, label }) {
  const [query,setQuery]=useState('')
  const shown=useMemo(()=>words.filter(w=>(w.english+' '+w.japanese).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[query, words])
  return <section className="word-list"><div className="list-head"><div><h1>単語一覧</h1><p>{label} · {words.length}語・句</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="英語・日本語で検索"/></div><div className="rows">{shown.map(w=><div className="word-row" key={w.id}><button onClick={()=>speak(w.english)}><Icon name="sound" size={20}/></button><div><strong>{w.english}</strong><span>{w.japanese}</span></div><em className={`status-badge ${wordStatus(progress[w.id])}`}>{STATUS_LABELS[wordStatus(progress[w.id])]}</em></div>)}</div></section>
}

function Complete({ title, count, restart, restartLabel, detail }) {
  return <section className="complete"><div className="complete-mark"><Icon name="leaf" size={48}/></div><h1>{title}</h1>{detail && <p>{detail}</p>}<p>{count}語の学習記録を保存しました。</p><button className="button primary" onClick={restart}><Icon name="refresh"/>{restartLabel}</button></section>
}

export default App
