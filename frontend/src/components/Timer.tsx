import React, { useEffect, useRef, useState } from 'react';

interface TimerProps {
    timeMs: number;
    isActive: boolean;
    isLow: boolean;
    timeDelta: { value: number; key: number } | null;
}

function formatTime(ms: number): string {
    if (ms < 0) ms = 0;
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((ms % 1000) / 100);

    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}.${tenths}`;
}

const Timer: React.FC<TimerProps> = ({ timeMs, isActive, isLow, timeDelta }) => {
    // Client-side interpolation: smoothly tick down between server updates
    const [displayMs, setDisplayMs] = useState(timeMs);
    const lastServerTime = useRef(timeMs);
    const lastUpdateAt = useRef(Date.now());
    const rafRef = useRef<number>(0);

    // When we get a new server time, reset our baseline
    useEffect(() => {
        lastServerTime.current = timeMs;
        lastUpdateAt.current = Date.now();
        setDisplayMs(timeMs);
    }, [timeMs]);

    // Smooth interpolation via requestAnimationFrame
    useEffect(() => {
        if (!isActive) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            return;
        }

        const tick = () => {
            const elapsed = Date.now() - lastUpdateAt.current;
            const interpolated = Math.max(0, lastServerTime.current - elapsed);
            setDisplayMs(interpolated);
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isActive]);

    const className = [
        'timer-display',
        isActive ? 'timer-display--active' : '',
        isLow ? 'timer-display--low' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={className}>
            {formatTime(displayMs)}
            {timeDelta && (
                <span
                    key={timeDelta.key}
                    className={`time-delta ${timeDelta.value > 0 ? 'time-delta--bonus' : 'time-delta--penalty'}`}
                >
                    {timeDelta.value > 0 ? `+${timeDelta.value / 1000}s` : `${timeDelta.value / 1000}s`}
                </span>
            )}
        </div>
    );
};

export default React.memo(Timer);
