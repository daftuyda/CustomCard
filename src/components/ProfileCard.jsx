import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import ModernTheme from './themes/ModernTheme.jsx';

const CARD_WIDTH = 760;

const ProfileCard = forwardRef(function ProfileCard({ profile }, ref) {
  const wrapRef = useRef(null);
  const cardRef = useRef(null);

  useImperativeHandle(ref, () => cardRef.current);

  useEffect(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;

    function update() {
      const parent = wrap.parentElement;
      const available = parent ? parent.clientWidth : window.innerWidth;
      const naturalHeight = card.offsetHeight;
      const scale = Math.min(1, available / CARD_WIDTH);

      if (scale < 1) {
        card.style.transform = `scale(${scale})`;
        card.style.transformOrigin = 'top left';
        wrap.style.width = `${CARD_WIDTH * scale}px`;
        wrap.style.height = `${naturalHeight * scale}px`;
      } else {
        card.style.transform = '';
        wrap.style.width = '';
        wrap.style.height = '';
      }
    }

    update();
    const ro = new ResizeObserver(update);
    if (wrap.parentElement) ro.observe(wrap.parentElement);
    ro.observe(card);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div ref={wrapRef} className="profile-card-wrap">
      <ModernTheme ref={cardRef} profile={profile} />
    </div>
  );
});

export default ProfileCard;
