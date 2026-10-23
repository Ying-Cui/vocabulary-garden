import { useCallback, useEffect, useMemo, useState } from 'react'
import { WORDS, STORAGE_KEY } from './data.js'
import { isDue, nextReviewAt, recordAnswer, stageMode, STATUS_LABELS, summarizeProgress, wordStatus } from './progress.js'
import { dailyBatch, mixedBatch, shuffle } from './learning.js'
import { photoSets, scopeWords } from './scopes.js'
import { Icon, ProgressBar, speak } from './ui.jsx'
import LearningSession from './LearningSession.jsx'

const PHOTO_SETS = photoSets(WORDS)
const SCOPE_KEY = `${STORAGE_KEY}-scope`
const DIRECTION_KEY = `${STORAGE_KEY}-quiz-direction`
const MIX_KEY = `${STORAGE_KEY}-mixed-photos`
const STAGE_LABELS = { card: 'カード', quiz: '4択', hint: 'ヒント付き入力', write: 'ヒントなし入力' }
function readSetting(key) { try { return localStorage.getItem(key) } catch { return null } }
function loadScope() {
  const saved = readSetting(SCOPE_KEY)
  return PHOTO_SETS.some(photo => photo.id === saved) ? saved : 'all'
}
function loadProgress() {
  let saved
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    if (Object.values(saved).some(record => record?.schemaVersion !== 3) && !localStorage.getItem(`${STORAGE_KEY}-before-v3`)) {
      try { localStorage.setItem(`${STORAGE_KEY}-before-v3`, raw) } catch { /* Current records still retain the original totals. */ }
    }
    return saved
  } catch { return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {} }
}
function loadMixedPhotos() {
  try {
    const saved = JSON.parse(readSetting(MIX_KEY))
    return Array.isArray(saved) ? saved.filter(source => PHOTO_SETS.some(photo => photo.id === source)) : PHOTO_SETS.map(photo => photo.id)
  } catch { return PHOTO_SETS.map(photo => photo.id) }
}
function dateLabel(timestamp) {
  return timestamp > 0 ? new Date(timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '今日'
}
function Header() {
  return <header className="header"><div className="brand"><Icon name="leaf" size={31}/><span>ことばの庭</span></div><div className="header-note">v2 · {WORDS.length}語・句</div></header>
}
function Nav({ screen, onChange }) {
  return <nav className="nav" aria-label="メインメニュー">{[['home','ホーム'],['card','カード'],['quiz','クイズ'],['write','入力テスト']].map(([id,label]) => <button key={id} className={screen === id ? 'active' : ''} onClick={()=>onChange(id)}><Icon name={id}/><span>{label}</span></button>)}</nav>
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [session, setSession] = useState(0)
  const [progress, setProgress] = useState(loadProgress)
  const [scope, setScope] = useState(loadScope)
  const [quizDirection, setQuizDirection] = useState(()=>readSetting(DIRECTION_KEY) === 'ja-en' ? 'ja-en' : 'en-ja')
  const [mixedPhotos, setMixedPhotos] = useState(loadMixedPhotos)
  const [storageError, setStorageError] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [batch, setBatch] = useState([])
  const [sessionInfo, setSessionInfo] = useState({ plan: 'card', weakOnly: false, pool: [], label: '' })

  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = setInterval(update, 60000)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
      localStorage.setItem(SCOPE_KEY, scope)
      localStorage.setItem(DIRECTION_KEY, quizDirection)
      localStorage.setItem(MIX_KEY, JSON.stringify(mixedPhotos))
      setStorageError(false)
    } catch { setStorageError(true) }
  }, [progress, scope, quizDirection, mixedPhotos])

  const saveResult = useCallback((word, correct, details = {}) => {
    const answeredAt = Date.now()
    setProgress(previous => recordAnswer(previous, word, correct, { ...details, now: answeredAt }))
    setNow(answeredAt)
  }, [])
  const selectedWords = useMemo(() => scopeWords(WORDS, scope), [scope])
  const summary = useMemo(() => summarizeProgress(WORDS, progress, now), [progress, now])
  const weakWords = useMemo(() => selectedWords.filter(word => wordStatus(progress[word.id], now) === 'weak'), [selectedWords, progress, now])
  const todayWords = useMemo(() => dailyBatch(WORDS, progress, 20, now), [progress, now])
  const dueCount = WORDS.filter(word => isDue(progress[word.id], now)).length
  const selectedPhoto = PHOTO_SETS.find(photo => photo.id === scope)
  const scopeLabel = selectedPhoto ? `${selectedPhoto.label} · ${selectedWords.length}語・句` : '全体からランダム20語'
  const futureDates = WORDS.map(word => nextReviewAt(progress[word.id])).filter(date => date !== null && date > now)
  const nextDue = futureDates.length ? Math.min(...futureDates) : null

  const start = (plan, weakOnly = false) => {
    const pool = plan === 'review' ? WORDS : plan === 'mixed' ? WORDS.filter(word => mixedPhotos.includes(word.source)) : selectedWords
    const candidates = weakOnly ? pool.filter(word => wordStatus(progress[word.id], Date.now()) === 'weak') : pool
    const nextWords = plan === 'review' ? dailyBatch(WORDS, progress, 20)
      : plan === 'mixed' ? mixedBatch(WORDS, mixedPhotos)
      : scope === 'all' ? shuffle(candidates).slice(0, 20) : [...candidates]
    const label = plan === 'review' ? '全200語から復習期限を優先 · 最大20語'
      : plan === 'mixed' ? `選んだ${mixedPhotos.length}枚の写真から混合 · ヒントなし`
      : `${scopeLabel}${weakOnly ? ' · 要復習だけ' : ''}`
    setBatch(nextWords)
    setSessionInfo({ plan, weakOnly, pool, label })
    setSession(value => value + 1)
    setScreen(plan)
  }
  const restart = () => start(sessionInfo.plan, sessionInfo.weakOnly)
  const restartLabel = sessionInfo.plan === 'review' ? '次の自動学習へ' : sessionInfo.plan === 'mixed' ? '写真を混ぜてもう一度'
    : sessionInfo.weakOnly ? '残っている要復習をもう一度' : scope === 'all' ? '別の20語でもう一度' : '同じ写真でもう一度'
  const changeQuizDirection = direction => { setQuizDirection(direction); start('quiz', sessionInfo.weakOnly) }

  return <div className="app-shell"><Header/><main>
    {storageError && <p className="storage-warning" role="alert">学習記録を端末に保存できません。ブラウザの保存設定をご確認ください。</p>}
    {screen === 'home' ? <Home {...{summary, dueCount, todayWords, weakWords, scope, setScope, selectedPhoto, start, mixedPhotos, setMixedPhotos}} onList={()=>setScreen('list')}/>
      : screen === 'list' ? <WordList words={selectedWords} progress={progress} now={now} label={scopeLabel}/>
      : !batch.length ? <section className="complete"><Icon name="check" size={48}/><h1>{screen === 'review' ? '今日の自動学習は完了しました' : 'この範囲に要復習の単語はありません'}</h1>
        <p>{nextDue ? `次の復習予定：${dateLabel(nextDue)}` : '学ぶ範囲を選んで次の学習へ進みましょう。'}</p><button className="button primary" onClick={()=>setScreen('home')}>ホームへ戻る</button></section>
      : <LearningSession key={session} words={batch} pool={sessionInfo.pool} progress={progress} plan={sessionInfo.plan} direction={quizDirection} onDirectionChange={changeQuizDirection}
        saveResult={saveResult} restart={restart} restartLabel={restartLabel} label={sessionInfo.label} onHome={()=>setScreen('home')}/>}
  </main><Nav screen={screen} onChange={id=>id === 'home' ? setScreen('home') : start(id)}/></div>
}

function Home({ summary, dueCount, todayWords, weakWords, scope, setScope, selectedPhoto, start, onList, mixedPhotos, setMixedPhotos }) {
  return <section className="home-layout"><div className="welcome">
    <h1>今日の学習</h1><p className="edition-note">v2 · p.93–115 · 全200語・句</p>
    <div className="daily-panel"><h2>今日の復習 <b>{dueCount}語</b></h2><p>期限が来た単語から始め、残りの枠で新しい単語を学びます。</p>
      <button className="button primary" onClick={()=>start('review')}>今日の自動学習（{todayWords.length}語）</button></div>
    <div className="scope-picker"><label htmlFor="study-scope">学ぶ範囲</label><select id="study-scope" value={scope} onChange={event=>setScope(event.target.value)}>
      <option value="all">全体からランダム20語</option>{PHOTO_SETS.map(photo=><option key={photo.id} value={photo.id}>{photo.label}：{photo.first} ～ {photo.last}（{photo.count}語）</option>)}</select>
      <p>{selectedPhoto ? `${selectedPhoto.filename} · p.${selectedPhoto.pages[0]}–${selectedPhoto.pages.at(-1)}。写真の掲載順に学習します。` : '自分で範囲を決めて学習したいときはこちら。'}</p></div>
    <div className="home-actions">
      <button className="button primary" onClick={()=>start('guided')}><Icon name="leaf"/>段階学習をはじめる<span>›</span></button>
      <button className="button secondary" onClick={()=>start('write', true)} disabled={!weakWords.length}><Icon name="refresh"/>要復習だけ入力（{weakWords.length}語）<span>›</span></button>
      <button className="button secondary" onClick={onList}><Icon name="list"/>単語一覧<span>›</span></button>
    </div>
    <p className="scope-help">下のメニューからカード・クイズ・入力も個別に選べます。</p>
    <details className="mixed-settings"><summary>写真を混ぜた実力テスト</summary><p>2枚以上選んで、日本語から英語をヒントなしで入力します。最大20語を、選んだ写真から混ぜて出題します。</p>
      <div className="photo-selection-actions"><button className="text-button" onClick={()=>setMixedPhotos(PHOTO_SETS.map(photo=>photo.id))}>すべて選択</button><button className="text-button" onClick={()=>setMixedPhotos([])}>選択を解除</button></div>
      <div className="photo-checks">{PHOTO_SETS.map(photo=><label key={photo.id}><input type="checkbox" checked={mixedPhotos.includes(photo.id)} onChange={event=>setMixedPhotos(previous=>event.target.checked ? [...previous,photo.id] : previous.filter(source=>source!==photo.id))}/><span>{photo.label} · {photo.first} ～ {photo.last}</span></label>)}</div>
      <button className="button secondary" disabled={mixedPhotos.length < 2} onClick={()=>start('mixed')}>混合テストを開始（{mixedPhotos.length}枚）</button></details>
    <div className="record"><div className="record-head"><div><h2>全体の学習記録</h2><span>別々の3日の入力正解で定着判定</span></div><strong>{summary.mastered}<small> / 200語</small></strong></div><ProgressBar value={summary.mastered} max={200}/>
      <div className="record-stats" aria-label="学習状況の内訳">{['mastered','weak','learning','unseen'].map(status=><span key={status}><i className={`dot ${status}`}/>{STATUS_LABELS[status]}<b>{summary[status]}語</b></span>)}</div>
      <p className="record-total">{summary.mastered} ＋ {summary.weak} ＋ {summary.learning} ＋ {summary.unseen} ＝ 200語</p>
      <p className="record-help">定着済みでも復習期限を迎えると要復習に戻ります。定着はアプリ上の判定です。</p></div>
    <details className="learning-rules"><summary>学習と定着判定のしくみ</summary><LearningRules/></details>
  </div><div className="home-preview learning-guide"><h2>少しずつ、思い出せる単語へ</h2><LearningRules/><div className="learning-note"><h3>4つの状態で記録</h3><p>未学習 → 練習中 → 定着。間違えた語や復習期限が来た語は要復習へ戻り、重複せず200語に集計します。</p></div></div></section>
}
function LearningRules() {
  return <div className="rules-content"><ol><li>カードで意味と発音を確認</li><li>日本語から英語を4択で確認</li><li>頭文字のヒントで英語を入力</li><li>ヒントなしで英語を入力</li></ol>
    <p>正解すると次の学習で段階が進みます。間違えた語は別の3語を挟んで再出題し、翌日も復習します。範囲が小さく間を空けられない場合は翌日に回します。</p>
    <p>復習期限を迎えた別々の3日に、ヒントなし入力で正解すると定着判定。答えを見た直後や同日の追加練習は回数に含めません。</p>
    <p>復習間隔の初期設定：1・3・7・14・30日。不正解なら翌日に戻します。学習日はこの端末の現地日付を使います。</p></div>
}
function WordList({ words, progress, now, label }) {
  const [query, setQuery] = useState('')
  const shown = useMemo(()=>words.filter(word=>(word.english+' '+word.japanese).toLowerCase().includes(query.toLowerCase())),[words,query])
  return <section className="word-list"><div className="list-head"><div><h1>単語一覧</h1><p>{label} · {words.length}語・句</p></div><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="英語・日本語で検索"/></div>
    <div className="rows">{shown.map(word=>{const record=progress[word.id], status=wordStatus(record,now);return <div className="word-row" key={word.id}><button onClick={()=>speak(word.english)} aria-label={`${word.english}の発音`}><Icon name="sound" size={20}/></button><div><strong>{word.english}</strong><span>{word.japanese}<small className="word-schedule">{STAGE_LABELS[stageMode(record)]}{record?.seen > 0 && ` · 次回 ${dateLabel(nextReviewAt(record))} · 定着確認 ${record.reviewStreak || 0}/3日`}</small></span></div><em className={`status-badge ${status}`}>{STATUS_LABELS[status]}</em></div>})}</div></section>
}
