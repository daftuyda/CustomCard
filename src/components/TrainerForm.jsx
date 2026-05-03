import { useState } from 'react';
import './TrainerForm.css';

export default function TrainerForm({
  onSubmit,
  loading,
  error,
  sampleId = '',
  initialId = '',
}) {
  const [id, setId] = useState(initialId);
  const [touched, setTouched] = useState(false);

  const trimmed = id.trim();
  const valid = /^\d{9,12}$/.test(trimmed);
  const showFormatError = touched && trimmed.length > 0 && !valid;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (valid && !loading) onSubmit(trimmed);
  }

  function fillSample() {
    setId(sampleId);
    setTouched(false);
    if (sampleId && !loading) onSubmit(sampleId);
  }

  return (
    <form className="tf" onSubmit={handleSubmit}>
      <div className="tf__legend">
        <span className="tf__legend-num">01</span>
        <span className="tf__legend-text">Trainer ID</span>
      </div>

      <div className={`tf__field ${showFormatError || error ? 'is-error' : ''}`}>
        <input
          id="trainer-id"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="9 to 12 digits"
          value={id}
          onChange={(e) => setId(e.target.value.replace(/\D/g, ''))}
          onBlur={() => setTouched(true)}
          maxLength={12}
          disabled={loading}
          className="tf__input"
        />
        <button
          type="submit"
          disabled={!valid || loading}
          className="tf__submit"
        >
          {loading ? (
            <span className="tf__spinner" aria-label="Loading" />
          ) : (
            <>
              Generate
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      </div>

      <div className="tf__meta">
        {showFormatError ? (
          <span className="tf__msg tf__msg--err">Trainer ID must be 9–12 digits.</span>
        ) : error ? (
          <span className="tf__msg tf__msg--err">{error}</span>
        ) : (
          <span className="tf__msg">
            Find this in-game on your profile (Friend ID).
          </span>
        )}
        {sampleId && (
          <button
            type="button"
            className="tf__sample"
            onClick={fillSample}
            disabled={loading}
          >
            Try sample → <span className="tf__sample-id">{sampleId}</span>
          </button>
        )}
      </div>
    </form>
  );
}
