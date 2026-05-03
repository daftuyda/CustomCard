import { useEffect, useRef, useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import TrainerForm from './components/TrainerForm.jsx';
import ProfileCard from './components/ProfileCard.jsx';
import { loadProfile, ProfileNotFoundError } from './api/profile.js';
import './App.css';

const SAMPLE_ID = '304265005615';

// Parse a trainer ID out of the URL path: /209154636873 -> "209154636873"
function readIdFromPath(pathname = window.location.pathname) {
  const m = pathname.match(/^\/(\d{9,12})\/?$/);
  return m ? m[1] : null;
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const cardRef = useRef(null);

  async function loadId(trainerId, { updateUrl = true } = {}) {
    setLoading(true);
    setError(null);
    setSubmittedId(trainerId);
    if (updateUrl && window.location.pathname !== `/${trainerId}`) {
      window.history.pushState({ trainerId }, '', `/${trainerId}`);
    }
    try {
      const p = await loadProfile(trainerId);
      setProfile(p);
    } catch (err) {
      setProfile(null);
      if (err instanceof ProfileNotFoundError) {
        setError(`No data found for trainer ID ${err.trainerId}.`);
      } else {
        setError(err.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(trainerId) {
    return loadId(trainerId);
  }

  // Auto-load from URL on mount, and react to back/forward navigation.
  useEffect(() => {
    const initial = readIdFromPath();
    if (initial) loadId(initial, { updateUrl: false });

    function onPop() {
      const id = readIdFromPath();
      if (id) {
        loadId(id, { updateUrl: false });
      } else {
        setProfile(null);
        setError(null);
        setSubmittedId('');
      }
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const node = cardRef.current;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: false,
        width: node.offsetWidth,
        height: node.offsetHeight,
        style: { transform: 'none', transformOrigin: 'unset' },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `umacard-${profile?.trainerId ?? 'card'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      setError('PNG export failed. Try again, or screenshot the card.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopy() {
    if (!cardRef.current) return;
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setError('Clipboard images aren’t supported by this browser. Use Download instead.');
      return;
    }
    setCopying(true);
    setCopied(false);
    try {
      const node = cardRef.current;
      const blob = await toBlob(node, {
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: false,
        width: node.offsetWidth,
        height: node.offsetHeight,
        style: { transform: 'none', transformOrigin: 'unset' },
      });
      if (!blob) throw new Error('empty blob');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error(err);
      setError('Copy to clipboard failed. Try Download instead.');
    } finally {
      setCopying(false);
    }
  }

  async function handleCopyLink() {
    if (!submittedId) return;
    const url = `${window.location.origin}/${submittedId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch (err) {
      console.error(err);
      setError('Could not copy link to clipboard.');
    }
  }

  function handleReset() {
    setProfile(null);
    setError(null);
    setSubmittedId('');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  }

  return (
    <div className="app">
      <header className="app__masthead">
        <div className="app__mark">
          <span className="app__mark-rule" aria-hidden="true" />
          <span className="app__mark-text">UMACARD</span>
          <span className="app__mark-rule" aria-hidden="true" />
        </div>
        <p className="app__tagline">Umamusume profile cards · data from <a href="https://uma.moe" target="_blank" rel="noreferrer">uma.moe</a></p>
      </header>

      <main className="app__main">
        {!profile && (
          <section className="app__form-stage">
            <TrainerForm
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              sampleId={SAMPLE_ID}
            />
          </section>
        )}

        {profile && (
          <section className="app__card-stage">
            <div className="app__toolbar">
              <button className="btn-ghost" onClick={handleReset} type="button">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M9.5 3.5L5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                New lookup
              </button>
              <button
                className="app__toolbar-id"
                onClick={handleCopyLink}
                type="button"
                title="Copy share link"
              >
                {linkCopied ? (
                  <>LINK COPIED</>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6.5 9.5L9.5 6.5M5.5 11.5l-2-2a2.5 2.5 0 010-3.5l2-2a2.5 2.5 0 013.5 0M10.5 4.5l2 2a2.5 2.5 0 010 3.5l-2 2a2.5 2.5 0 01-3.5 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    /{submittedId}
                  </>
                )}
              </button>
              <button
                className="btn-ghost"
                onClick={handleCopy}
                disabled={copying || downloading}
                type="button"
              >
                {copying ? (
                  'Copying…'
                ) : copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Copy image
                  </>
                )}
              </button>
              <button
                className="btn-primary"
                onClick={handleDownload}
                disabled={downloading}
                type="button"
              >
                {downloading ? (
                  'Rendering…'
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Download PNG
                  </>
                )}
              </button>
            </div>

            <div className="app__stage">
              <ProfileCard ref={cardRef} profile={profile} />
            </div>
          </section>
        )}
      </main>

      <footer className="app__colophon">
        <span>Not affiliated with Cygames.</span>
      </footer>
    </div>
  );
}
