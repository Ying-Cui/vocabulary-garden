import { useMemo, useRef, useState } from 'react'
import { WORDS } from './data.js'
import { acceptsAnswer, createOptions } from './study.js'
import { stageMode } from './progress.js'
import { enqueueReview, hintFor } from './learning.js'
import { Complete, Icon, speak, StudyHeader } from './ui.jsx'

const MODES = { card: 'カード', quiz: '4択', hint: 'ヒント付き入力', write: 'ヒントなし入力' }

export default function LearningSession({ words, pool, progress, plan, direction, onDirectionChange, saveResult, restart, restartLabel, label, onHome }) {
  const [queue, setQueue] = useState(() => words.map(word => ({
    word, mode: ['guided', 'review'].includes(plan) ? stageMode(progress[word.id]) : plan === 'mixed' ? 'write' : plan,
    replay: false, filler: false
  })))
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [firstResult, setFirstResult] = useState(null)
  const [initialCorrect, setInitialCorrect] = useState(0)
  const [selected, setSelected] = useState(null)
  const [value, setValue] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [scheduled, setScheduled] = useState(false)
  const inputRef = useRef(null)
  const locked = useRef(false)
  const item = queue[index]
  const word = item?.word
  const mode = item?.mode
  const reverse = plan !== 'quiz' || direction === 'ja-en'
  const options = useMemo(() => word && mode === 'quiz' ? createOptions(word, WORDS) : [], [word, mode, index])
  const practice = firstResult !== null

  function answer(correct, optionId = null) {
    if (locked.current || result !== null) return
    locked.current = true
    inputRef.current?.blur()
    setSelected(optionId)
    setResult(correct)
    if (firstResult === null) {
      setFirstResult(correct)
      if (correct && !item.replay && !item.filler) setInitialCorrect(previous => previous + 1)
      saveResult(word, correct, { mode, hintUsed: hintUsed || mode === 'hint', replay: item.replay || item.filler })
      if (!correct) {
        const nextQueue = enqueueReview(queue, index, pool)
        setScheduled(nextQueue !== queue)
        setQueue(nextQueue)
      }
    }
  }
  function retry() {
    setResult(null)
    setValue('')
    setHintUsed(false)
    locked.current = false
    inputRef.current?.focus()
  }
  function next() {
    if (result === null) return
    setIndex(previous => previous + 1)
    setResult(null)
    setFirstResult(null)
    setSelected(null)
    setValue('')
    setFlipped(false)
    setHintUsed(false)
    setScheduled(false)
    locked.current = false
    inputRef.current?.focus()
  }
  function check(event) {
    event.preventDefault()
    if (!value.trim()) return
    answer(acceptsAnswer(value, word, WORDS))
  }

  if (!item) return <Complete title={`初回の結果：${initialCorrect} / ${words.length} 語正解`} count={words.length}
    detail={`追加の復習 ${queue.length - words.length}問。翌日以降の復習はホームで確認できます。`}
    restart={restart} restartLabel={restartLabel} onHome={onHome}/>

  const title = plan === 'review' ? '今日の自動学習' : plan === 'guided' ? '段階学習' : plan === 'mixed' ? '写真を混ぜた実力テスト' : mode === 'card' ? 'カードで学習' : mode === 'quiz' ? '4択クイズ' : '入力テスト'
  const isInput = mode === 'hint' || mode === 'write'
  const englishAnswer = mode !== 'quiz' || reverse
  return <section className={`study trainer ${result !== null ? 'answered' : ''} ${mode === 'quiz' ? 'quiz' : ''} ${reverse && mode === 'quiz' ? 'quiz-reverse' : ''}`}>
    <StudyHeader title={title} index={index} total={queue.length} label={label}/>
    <p className="learning-stage" role="note">{item.replay ? '少し後の再テスト' : item.filler ? '間を空けるための復習' : MODES[mode]}{(item.replay || item.filler) && ' · 定着回数には含めません'}</p>
    {plan === 'quiz' && <div className="quiz-direction"><label htmlFor="quiz-direction">クイズの向き</label>
      <select id="quiz-direction" value={direction} onChange={event=>onDirectionChange(event.target.value)}><option value="en-ja">英語 → 日本語</option><option value="ja-en">日本語 → 英語</option></select>
      <small>切り替えると1問目から始まります。回答済みの記録は残ります。</small></div>}
    {mode === 'card' && <>
      <div className={`flashcard ${flipped ? 'flipped' : ''}`} role="button" tabIndex={0} aria-label="カードをめくる" onClick={()=>setFlipped(previous=>!previous)}
        onKeyDown={event=>{if(event.target===event.currentTarget && ['Enter',' '].includes(event.key)){event.preventDefault();setFlipped(previous=>!previous)}}}>
        <span>{flipped ? '意味' : '英語'}</span><strong>{flipped ? word.japanese : word.english}</strong><em/>
        <button className="sound" aria-label="発音を聞く" onClick={event=>{event.stopPropagation();speak(word.english)}}><Icon name="sound"/></button>
        <small>{flipped ? 'もう一度タップで英語へ' : 'タップして意味を見る'}</small>
      </div>
      {result === null && <div className="answer-actions"><button className="button retry" onClick={()=>answer(false)}>まだ覚えていない</button><button className="button primary" onClick={()=>answer(true)}>確認できた</button></div>}
    </>}
    {mode === 'quiz' && <>
      <div className="question"><span>{reverse ? 'この日本語に合う英語は？' : 'この英単語の意味は？'}</span>
        <strong lang={reverse ? 'ja' : 'en'}>{reverse ? word.japanese : word.english}</strong>
        {(!reverse || result !== null) && <button className="sound" onClick={()=>speak(word.english)} aria-label="発音を聞く"><Icon name="sound"/></button>}
      </div>
      <div className="options">{options.map((option,i)=><button key={option.id} disabled={result !== null} onClick={()=>answer(option.id === word.id, option.id)}
        className={result !== null ? (option.id === word.id ? 'correct' : option.id === selected ? 'wrong' : 'dim') : ''}><span>{String.fromCharCode(65+i)}</span><b lang={reverse ? 'en' : 'ja'}>{reverse ? option.english : option.japanese}</b></button>)}</div>
    </>}
    {isInput && <form className="typing-card" onSubmit={check}>
      <span>{practice && result === null ? 'もう一度、英語で入力してみましょう' : '日本語を見て英語で入力してください'}</span>
      <strong>{word.japanese}</strong>
      {(mode === 'hint' || hintUsed) && <p className="answer-hint" aria-label="英語のヒント">{hintFor(word)}</p>}
      <input ref={inputRef} autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} readOnly={result !== null} value={value} onChange={event=>setValue(event.target.value)} aria-label="英単語の答え" placeholder="答えを入力"/>
      {result === null && <div className="input-actions"><button type="submit" className="button primary" disabled={!value.trim()}>答え合わせ</button>
        <button type="button" className="text-button" onClick={()=>answer(false)}>わからない</button>
        {mode === 'write' && plan !== 'mixed' && !hintUsed && <button type="button" className="text-button" onClick={()=>setHintUsed(true)}>ヒントを見る</button>}</div>}
      {(mode === 'hint' || hintUsed) && <p className="practice-note">ヒントを見た回答は、定着回数には含めません。</p>}
      {practice && <p className="practice-note">もう一度入力する練習は、得点・学習記録に重複加算しません。</p>}
    </form>}
    {result !== null && <div className={`feedback ${result ? 'ok' : 'ng'}`} aria-live="polite">
      <b>{result ? (mode === 'card' ? '確認しました' : '正解！') : 'もう一度覚えよう'}</b>
      <span>正解：{englishAnswer ? word.english : word.japanese}</span>
      {!result && firstResult === false && <p className="practice-note">{scheduled ? '別の3語以上を挟んで再出題します。翌日も復習しましょう。' : item.replay || item.filler ? '追加の復習はここまでです。翌日の復習で、もう一度確認します。' : 'この範囲では間を空けられないため、翌日の復習に残します。'}</p>}
      {isInput && <button type="button" className="button secondary retry-input" onClick={retry}><Icon name="refresh"/>もう一度入力する</button>}
      <button className="button primary" onClick={next}>{index === queue.length - 1 ? '結果を見る' : '次の問題'}</button>
    </div>}
  </section>
}
