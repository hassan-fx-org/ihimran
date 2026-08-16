/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ultra-sleek obsidian dark theme
        background: '#090D16',
        'background-alt': '#0B0F19',
        surface: '#0E131E',
        'surface-hover': '#131A2A',
        elevated: '#161D2E',
        muted: '#1A2233',
        'muted-hover': '#1F2A3F',
        border: '#1E283A',
        'border-muted': '#252E42',
        
        // Electric accent colors
        primary: '#3B82F6',      // Electric indigo
        'primary-glow': '#60A5FA',
        secondary: '#8B5CF6',    // Violet
        'secondary-glow': '#A78BFA',
        cyan: '#06B6D4',         // Electric cyan
        'cyan-glow': '#22D3EE',
        emerald: '#10B981',      // Emerald
        'emerald-glow': '#34D399',
        amber: '#F59E0B',        // Amber/warning
        'amber-glow': '#FBBF24',
        danger: '#EF4444',       // Danger
        'danger-glow': '#F87171',
        
        // Text colors
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        textDim: '#475569',
        
        // Semantic aliases for backward compatibility
        success: '#10B981',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        // Glassmorphism shadows with glow
        glass: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 24px rgba(0,0,0,0.4)',
        'glass-lg': '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 40px rgba(0,0,0,0.5)',
        'glass-xl': '0 1px 0 rgba(255,255,255,0.05) inset, 0 16px 60px rgba(0,0,0,0.6)',
        
        // Colored glow shadows
        'glow-primary': '0 0 0 1px rgba(59,130,246,0.3), 0 8px 32px rgba(59,130,246,0.15)',
        'glow-primary-lg': '0 0 0 1px rgba(59,130,246,0.4), 0 16px 48px rgba(59,130,246,0.2)',
        'glow-cyan': '0 0 0 1px rgba(6,182,212,0.3), 0 8px 32px rgba(6,182,212,0.12)',
        'glow-cyan-lg': '0 0 0 1px rgba(6,182,212,0.4), 0 16px 48px rgba(6,182,212,0.18)',
        'glow-emerald': '0 0 0 1px rgba(16,185,129,0.3), 0 8px 32px rgba(16,185,129,0.12)',
        'glow-emerald-lg': '0 0 0 1px rgba(16,185,129,0.4), 0 16px 48px rgba(16,185,129,0.18)',
        'glow-violet': '0 0 0 1px rgba(139,92,246,0.3), 0 8px 32px rgba(139,92,246,0.12)',
        'glow-violet-lg': '0 0 0 1px rgba(139,92,246,0.4), 0 16px 48px rgba(139,92,246,0.18)',
        'glow-amber': '0 0 0 1px rgba(245,158,11,0.3), 0 8px 32px rgba(245,158,11,0.12)',
        
        // Card shadows
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 24px rgba(0,0,0,0.35)',
        'card-hover': '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 40px rgba(0,0,0,0.5)',
        pop: '0 20px 60px rgba(0,0,0,0.6)',
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'glow-primary': 'radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)',
        'glow-cyan': 'radial-gradient(ellipse at center, rgba(6,182,212,0.12) 0%, transparent 70%)',
        'glow-emerald': 'radial-gradient(ellipse at center, rgba(16,185,129,0.1) 0%, transparent 70%)',
        'glow-violet': 'radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, transparent 70%)',
        'mesh-gradient': 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(6,182,212,0.06) 50%, rgba(16,185,129,0.05) 100%)',
      },
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateX(24px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0.4)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(59,130,246,0.3)' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(59,130,246,0.3)' },
          '50%': { borderColor: 'rgba(59,130,246,0.6)' },
        },
        'progress-fill': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-width)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulse-soft 2.5s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite',
        'progress-fill': 'progress-fill 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      transitionDuration: {
        '0': '0ms',
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '350': '350ms',
        '400': '400ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}