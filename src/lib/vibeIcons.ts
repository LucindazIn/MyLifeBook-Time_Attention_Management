import energyHighUrl from '@/assets/vibes/energy-high.svg?url';
import moodHappyUrl from '@/assets/vibes/mood-happy.svg?url';
import focusFocusedUrl from '@/assets/vibes/focus-focused.svg?url';

/** Bundled asset URLs — avoids relying on `public/vibes` (may be missing on some deploys). */
export const VIBE_ICON_URL = {
  energy: energyHighUrl,
  mood: moodHappyUrl,
  focus: focusFocusedUrl,
} as const;
