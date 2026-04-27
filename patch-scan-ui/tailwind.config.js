/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Dark mode is handled entirely by CSS variables in theme.css
  // ([data-theme="dark"] on <html> overrides all --tokens automatically)
  // so Tailwind dark: variants are not needed.
  theme: {
    extend: {
      colors: {
        // Surfaces
        'bg-page':         'var(--bg-page)',
        'bg-card':         'var(--bg-card)',
        'bg-row':          'var(--bg-row)',
        'bg-hover':        'var(--bg-hover)',
        'bg-subtle':       'var(--bg-subtle)',
        'bg-sidebar':      'var(--bg-sidebar)',
        'bg-sidebar-item': 'var(--bg-sidebar-item)',
        // Borders (as bg colors for border utilities via outline/ring, or direct use)
        'border-base':     'var(--border)',
        'border-subtle':   'var(--border-subtle)',
        'border-muted':    'var(--border-muted)',
        'border-dark':     'var(--border-dark)',
        // Text
        'text-primary':    'var(--text-primary)',
        'text-secondary':  'var(--text-secondary)',
        'text-muted-c':    'var(--text-muted)',
        'text-faint':      'var(--text-faint)',
        'text-ghost':      'var(--text-ghost)',
        'text-disabled':   'var(--text-disabled)',
        // Blue
        'blue':            'var(--blue)',
        'blue-dark':       'var(--blue-dark)',
        'blue-deep':       'var(--blue-deep)',
        'blue-tint':       'var(--blue-tint)',
        'blue-border':     'var(--blue-border)',
        'blue-light':      'var(--blue-light)',
        // Indigo
        'indigo':          'var(--indigo)',
        'indigo-dark':     'var(--indigo-dark)',
        'indigo-tint':     'var(--indigo-tint)',
        'indigo-border':   'var(--indigo-border)',
        // Cyan
        'cyan':            'var(--cyan)',
        'cyan-dark':       'var(--cyan-dark)',
        'cyan-tint':       'var(--cyan-tint)',
        'cyan-border':     'var(--cyan-border)',
        // Green
        'green':           'var(--green)',
        'green-dark':      'var(--green-dark)',
        'green-deeper':    'var(--green-deeper)',
        'green-text':      'var(--green-text)',
        'green-bright':    'var(--green-bright)',
        'green-light':     'var(--green-light)',
        'green-tint':      'var(--green-tint)',
        'green-tint-mid':  'var(--green-tint-mid)',
        'green-border':    'var(--green-border)',
        'green-border-lt': 'var(--green-border-lt)',
        // Red
        'red':             'var(--red)',
        'red-dark':        'var(--red-dark)',
        'red-darker':      'var(--red-darker)',
        'red-text':        'var(--red-text)',
        'red-tint':        'var(--red-tint)',
        'red-tint-mid':    'var(--red-tint-mid)',
        'red-border':      'var(--red-border)',
        'red-border-lt':   'var(--red-border-lt)',
        // Orange / Amber
        'amber':           'var(--amber)',
        'orange':          'var(--orange)',
        'orange-dark':     'var(--orange-dark)',
        'orange-darker':   'var(--orange-darker)',
        'orange-text':     'var(--orange-text)',
        'orange-tint':     'var(--orange-tint)',
        'amber-tint':      'var(--amber-tint)',
        'amber-tint-lt':   'var(--amber-tint-lt)',
        'orange-border':   'var(--orange-border)',
        'orange-border-lt':'var(--orange-border-lt)',
        // Purple
        'purple':          'var(--purple)',
        'purple-dark':     'var(--purple-dark)',
        'purple-tint':     'var(--purple-tint)',
        'purple-border':   'var(--purple-border)',
        'purple-tint-lt':  'var(--purple-tint-lt)',
        'purple-border-lt':'var(--purple-border-lt)',
        // Teal
        'teal':            'var(--teal)',
        'teal-tint':       'var(--teal-tint)',
        'teal-border':     'var(--teal-border)',
        // Yellow
        'yellow-dark':     'var(--yellow-dark)',
        'yellow-darker':   'var(--yellow-darker)',
        'yellow-tint':     'var(--yellow-tint)',
        'yellow-border':   'var(--yellow-border)',
      },
      fontSize: {
        'xxs':  ['10px', { lineHeight: '1.4' }],
        'xs':   ['11px', { lineHeight: '1.4' }],
        'sm':   ['12px', { lineHeight: '1.5' }],
        'md':   ['13px', { lineHeight: '1.5' }],
        'base': ['14px', { lineHeight: '1.5' }],
        'lg':   ['15px', { lineHeight: '1.5' }],
        'xl':   ['16px', { lineHeight: '1.5' }],
        '2xl':  ['18px', { lineHeight: '1.4' }],
        '3xl':  ['22px', { lineHeight: '1.3' }],
        '4xl':  ['32px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        'sm':   '4px',
        'md':   '6px',
        'base': '8px',
        'lg':   '10px',
        'xl':   '12px',
        '2xl':  '14px',
        '3xl':  '16px',
        'pill': '999px',
      },
      boxShadow: {
        'card':     'var(--shadow-card)',
        'dropdown': 'var(--shadow-dropdown)',
        'modal':    'var(--shadow-modal)',
        'modal-lg': 'var(--shadow-modal-lg)',
        'toast':    'var(--shadow-toast)',
        'tooltip':  'var(--shadow-tooltip)',
      },
      // Tailwind's default spacing (p-1=4px, p-2=8px … p-8=32px) matches the
      // design token scale exactly — no custom spacing needed.
    },
  },
  plugins: [],
}
