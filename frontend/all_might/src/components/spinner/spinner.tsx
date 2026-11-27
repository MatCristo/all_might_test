import styles from './spinner.module.css';

interface SpinnerProps {
    /** Diameter in px. The ring thickness scales with it. */
    size?: number;
    /** Use 'onAccent' on a filled button or any other coloured surface. */
    tone?: 'auto' | 'onAccent';
    /**
     * Announced by screen readers while the spinner is up. Leave it out when
     * something around the spinner already says the same thing, and the spinner
     * is hidden from the accessibility tree instead.
     */
    label?: string;
}

export default function Spinner({ size = 20, tone = 'auto', label }: SpinnerProps) {
    const a11y = label
        ? { role: 'status', 'aria-label': label }
        : { 'aria-hidden': true };

    return (
        <span
            className={`${styles.spinner} ${tone === 'onAccent' ? styles.onAccent : ''}`}
            style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 7)) }}
            {...a11y}
        />
    );
}
