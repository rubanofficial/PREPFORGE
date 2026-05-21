/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: 'var(--background)',
                surface: 'var(--surface)',
                surfaceHover: 'var(--surface-hover)',
                border: 'var(--border)',
                textMain: 'var(--text-main)',
                textMuted: 'var(--text-muted)',
                primary: 'var(--primary)',
                primaryHover: 'var(--primary-hover)',
                success: 'var(--success)',
                warning: 'var(--warning)',
                danger: 'var(--danger)',
                leetcodeEasy: 'var(--leetcode-easy)',
                leetcodeMedium: 'var(--leetcode-medium)',
                leetcodeHard: 'var(--leetcode-hard)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Fira Code', 'monospace'],
            },
        },
    },
    plugins: [],
}
