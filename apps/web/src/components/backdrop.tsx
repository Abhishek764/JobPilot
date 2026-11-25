import Image from 'next/image';

import ridge from '@/assets/backgrounds/ridge.jpg';

/**
 * Fixed, decorative scene behind every page: photo, liquid-metal field, sheen, grain and
 * vignette (styles: globals.css `.backdrop-*`). Hidden from assistive tech and input.
 * Photo: "Mountain slopes against dark sky", Pexels photo 5459512 (Pexels licence),
 * served through next/image so each screen gets a sized WebP/AVIF.
 */
export const Backdrop = () => (
  <div aria-hidden className="backdrop">
    <div className="backdrop-photo">
      <Image
        src={ridge}
        alt=""
        fill
        priority
        quality={90}
        sizes="100vw"
        placeholder="blur"
        className="backdrop-photo-img"
      />
    </div>
    <div className="backdrop-metal" />
    <div className="backdrop-sheen" />
    <div className="backdrop-grain" />
    <div className="backdrop-vignette" />
  </div>
);
