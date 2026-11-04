import Link from "next/link";

export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header container">
        <Link className="wordmark" href="/" aria-label="Foodie home">Foodie<span aria-hidden="true">.</span></Link>
        <span className="demo-badge">Customer demo</span>
      </header>
    </>
  );
}
