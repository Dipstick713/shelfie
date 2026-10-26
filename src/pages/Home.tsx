import { Link } from 'react-router-dom'
import { CATEGORIES } from '../lib/categories'

export function Home() {
  return (
    <main className="home">
      <section className="hero">
        <h1>
          Show the world your <span className="accent">favourites</span>.
        </h1>
        <p className="muted">
          Build a grid of the albums, EPs, artists, movies and games that define you. Any size, any colours — then share
          it or download it as an image.
        </p>
      </section>
      <section className="category-cards">
        {Object.values(CATEGORIES).map((c) => (
          <Link key={c.id} to={`/create/${c.id}`} className="category-card">
            <span className="emoji">{c.emoji}</span>
            <h2>{c.label}</h2>
            <p className="muted">{c.blurb}</p>
            <span className="go">Start a grid →</span>
          </Link>
        ))}
      </section>
    </main>
  )
}
