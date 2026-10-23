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

export function Icon({ name, size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

export function ProgressBar({ value, max }) {
  return <div className="progress-track" aria-label={`${max}問中${value}問`}><span style={{width:`${max ? value/max*100 : 0}%`}} /></div>
}

export function StudyHeader({ title, index, total, label }) {
  return <div className="study-head"><p className="session-label">{label}</p><div><h1>{title}</h1><span>{index + 1} / {total}</span></div><ProgressBar value={index + 1} max={total}/></div>
}

export function speak(word) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(word.replace('~',''))
  utterance.lang = 'en-US'; utterance.rate = .82; speechSynthesis.speak(utterance)
}

export function Complete({ title, count, restart, restartLabel, detail, onHome }) {
  return <section className="complete"><div className="complete-mark"><Icon name="leaf" size={48}/></div><h1>{title}</h1>{detail && <p>{detail}</p>}<p>{count}語の学習を記録しました。</p><button className="button primary" onClick={restart}><Icon name="refresh"/>{restartLabel}</button>{onHome && <button className="button secondary" onClick={onHome}>ホームへ戻る</button>}</section>
}
