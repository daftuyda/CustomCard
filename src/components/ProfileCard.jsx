import { forwardRef } from 'react';
import ModernTheme from './themes/ModernTheme.jsx';

const ProfileCard = forwardRef(function ProfileCard({ profile }, ref) {
  return (
    <div ref={ref} className="profile-card-wrap">
      <ModernTheme profile={profile} />
    </div>
  );
});

export default ProfileCard;
