import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../lib/categories'
import { ShelfBot } from '../components/ShelfBot'
import { BOT_MOODS } from '../lib/moods'
import { CategoryDoodle, Marquee, ShuffleTile } from '../components/Doodles'

const STEPS = [
  { title: 'Pick a shelf', body: 'Albums, artists, movies or games. Any size from 1×1 to 12×12.' },
  { title: 'Fill it up', body: "Search millions of covers, or upload your own when something's too obscure." },
  { title: 'Show it off', body: 'Get a share link or a crisp PNG. Square grids stay square.' },
]

export function Home() {
  const [mood, setMood] = useState(0)
  const [hop, setHop] = useState(0)
  const [happy, setHappy] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setMood((m) => (m + 1) % BOT_MOODS.length), 4200)
    return () => clearInterval(t)
  }, [])

  const poke = () => {
    setMood((m) => (m + 1 + Math.floor(Math.random() * (BOT_MOODS.length - 1))) % BOT_MOODS.length)
    setHop((h) => h + 1)
    setHappy(true)
  }

  useEffect(() => {
    if (!happy) return
    const t = setTimeout(() => setHappy(false), 1400)
    return () => clearTimeout(t)
  }, [happy, hop])

  return (
    <main className="home">
      <section className="hero">
        <i className="mark tl" />
        <i className="mark tr" />
        <h1 className="wordmark" aria-label="Shelfie">
          {'SHELFIE'.split('').map((ch, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties}>
              {ch}
            </span>
          ))}
        </h1>
        <div className="hero-sub">
          <span>
            <i className="mark inline" /> YOUR FAVOURITES
          </span>
          <span>ON ONE SHELF</span>
          <span className="spacer" />
          <span className="muted">GRID MAKER · v2</span>
          <i className="mark br" />
        </div>
      </section>

      <section className="bento hero-row">
        <div className="cell intro">
          <p className="lede">
            Stack the albums, EPs, artists, movies and games that made you into one tidy, shareable grid.
          </p>
          <Link to="/create/albums" className="btn primary big">
            Make a grid <span className="arrow">→</span>
          </Link>
          <span className="tiny muted mono">no account needed · saves as you go</span>
        </div>

        <div className="cell bot-stage">
          <div className="bubble mono" key={mood}>
            <span className="muted">shelf-bot is </span>
            {BOT_MOODS[mood]}
          </div>
          <button className="bot-button" onClick={poke} aria-label="Poke shelf-bot">
            <ShelfBot size={220} track happy={happy} className={hop ? `hop hop-${hop % 2}` : ''} />
          </button>
          <div className="plinth" />
        </div>

        <div className="cell side">
          <div className="dark-tile brackets">
            <ShuffleTile />
          </div>
          <dl className="facts mono">
            <div>
              <dt>Shelves</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>Max grid</dt>
              <dd>12×12</dd>
            </div>
            <div>
              <dt>Export</dt>
              <dd>PNG</dd>
            </div>
          </dl>
        </div>
      </section>

      <Marquee words={['ALBUMS', 'EPS', 'SINGLES', 'ARTISTS', 'MOVIES', 'GAMES', 'TOP 9', 'NO SKIPS']} />

      <section className="bento cats">
        {Object.values(CATEGORIES).map((c, i) => (
          <Link key={c.id} to={`/create/${c.id}`} className="cell cat-tile doodle-host" style={{ '--cat': c.accent } as CSSProperties}>
            <span className="cat-index mono">{String(i + 1).padStart(2, '0')}</span>
            <CategoryDoodle category={c.id} size={72} />
            <h2>{c.label}</h2>
            <p className="muted">{c.blurb}</p>
            <span className="go mono">
              START <span className="arrow">→</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="bento steps">
        {STEPS.map((s, i) => (
          <div key={s.title} className="cell step">
            <span className="step-num">{i + 1}</span>
            <h3>{s.title}</h3>
            <p className="muted">{s.body}</p>
          </div>
        ))}
      </section>

      <footer className="foot mono">
        <span>
          <i className="mark inline" /> SHELFIE
        </span>
        <span className="spacer" />
        <a href="https://github.com/Dipstick713" target="_blank" rel="noreferrer">
          built by dipstick ↗
        </a>
      </footer>
    </main>
  )
}
