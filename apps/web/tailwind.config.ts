import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/** `<alpha-value>` lets opacity modifiers (bg-card/70, border-primary/40) work on token colours. */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        // San Francisco on Apple devices, Inter everywhere else.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          'var(--font-inter)',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
      },
      borderRadius: {
        '3xl': '1.75rem',
        '2xl': '1.25rem',
        xl: '1rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      transitionTimingFunction: {
        // Apple-like ease-out with a soft settle.
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: { 400: '400ms' },
    },
  },
  plugins: [animate],
};

export default config;
