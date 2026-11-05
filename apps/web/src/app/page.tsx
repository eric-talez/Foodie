import { LocationPicker } from "../components/LocationPicker";
import { SiteHeader } from "../components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container" tabIndex={-1}>
        <div className="home-grid">
          <section className="hero" aria-labelledby="home-heading">
            <p className="eyebrow">Good food. Fairer delivery.</p>
            <h1 id="home-heading">Local food.<br />Lower fees.<br /><span>More fairness.</span></h1>
            <p className="hero-description">Foodie’s promise: transparent, lower fees for you and fair pay for drivers. Start by choosing where you’d like to explore.</p>
            <div className="promise-note">
              <span className="promise-mark" aria-hidden="true">↗</span>
              <p>A little closer. A little fairer.<br /><strong>Built around your neighborhood.</strong></p>
            </div>
          </section>
          <LocationPicker />
        </div>
      </main>
      <footer className="site-footer container">
        <p>Santa Clara &amp; San Jose demo</p>
        <p>Ordering is not live yet. Sample locations and menus only.</p>
      </footer>
    </>
  );
}
