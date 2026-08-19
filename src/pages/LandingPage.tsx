import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="auth-brand">
          <div className="brand-mark">
            <img src="/matta-logo.png" alt="MATTA" />
          </div>
          <div className="brand-text">
            <span className="brand-text-main">MATTA</span>
            <span className="brand-text-sub">Learning Portfolio</span>
          </div>
        </div>
        <nav className="landing-nav">
          <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link to="/signup" className="btn btn-primary btn-sm">Get started</Link>
        </nav>
      </header>

      <main className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-eyebrow">Browave Philippines · Management Associate Training</p>
          <h1 className="landing-headline">
            Document your <em>growth</em>.<br />
            Shape your <em>future</em> at Browave.
          </h1>
          <p className="landing-lede">
            The MATTA Learning Portfolio is your living record of the six-month
            management associate program. Log your courses, reflections, projects,
            and assessments — and watch the story of your leadership take shape.
          </p>
          <div className="landing-cta-row">
            <Link to="/signup" className="btn btn-primary">
              Create your portfolio
            </Link>
            <Link to="/login" className="btn btn-ghost">
              I already have an account
            </Link>
          </div>
          <p className="landing-hint">
            Use your <strong>@browave.com</strong> email to register.
          </p>
        </div>

        <aside className="landing-hero-aside">
          <div className="landing-checklist-card">
            <h3 className="landing-checklist-title">What you'll track</h3>
            <ul className="landing-checklist">
              <li>Daily reading &amp; reflections (Phase 1)</li>
              <li>Department-specific training (Phase 2)</li>
              <li>Tests, homework, and final assessments</li>
              <li>QCC project and presentations</li>
              <li>Mentor feedback and commendations</li>
              <li>Your own custom growth entries</li>
            </ul>
          </div>
        </aside>
      </main>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Browave Corporation · MATTA Program</span>
        <span>v0.2</span>
      </footer>
    </div>
  )
}
