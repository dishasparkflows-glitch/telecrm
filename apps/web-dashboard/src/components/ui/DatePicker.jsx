import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-calendar/dist/Calendar.css';

export default function DatePicker({ value, onChange, placeholder, disabled, minDate }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Parse value (YYYY-MM-DD) to Date object
    const [date, setDate] = useState(() => {
        if (!value) return null;
        const [year, month, day] = value.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    });

    useEffect(() => {
        if (!value) {
            setDate(null);
            return;
        }
        const [year, month, day] = value.split('-');
        setDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
    }, [value]);

    const handleDateChange = (newDate) => {
        setDate(newDate);
        setIsOpen(false);
        if (onChange) {
            const year = newDate.getFullYear();
            const month = String(newDate.getMonth() + 1).padStart(2, '0');
            const day = String(newDate.getDate()).padStart(2, '0');
            onChange({ target: { value: `${year}-${month}-${day}` } });
        }
    };

    const handleClear = () => {
        setDate(null);
        setIsOpen(false);
        if (onChange) {
            onChange({ target: { value: '' } });
        }
    };

    const handleToday = () => {
        const today = new Date();
        handleDateChange(today);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)]
                    text-sm text-[var(--vz-heading)] px-3 py-2 outline-none transition-all duration-200
                    flex items-center gap-2 cursor-pointer
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}
                    ${isOpen ? 'border-primary ring-1 ring-primary/30' : ''}`}
            >
                <div className="text-[var(--vz-text-muted)] flex-shrink-0">
                    <CalendarIcon size={16} />
                </div>
                <div className={`flex-1 truncate ${!date ? 'text-[var(--vz-text-muted)]' : ''}`}>
                    {date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (placeholder || 'Select date')}
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[280px]">
                    <div className="custom-calendar-wrapper">
                        <Calendar
                            onChange={handleDateChange}
                            value={date}
                            minDate={minDate}
                            prevLabel={<ChevronLeft size={16} />}
                            nextLabel={<ChevronRight size={16} />}
                            prev2Label={null}
                            next2Label={null}
                            showNeighboringMonth={false}
                            formatShortWeekday={(locale, date) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][date.getDay()]}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 px-1">
                        <button 
                            type="button"
                            onClick={handleToday}
                            className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                        >
                            Today
                        </button>
                        <button 
                            type="button"
                            onClick={handleClear}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    
                    <style dangerouslySetInnerHTML={{__html: `
                        .custom-calendar-wrapper .react-calendar {
                            border: none;
                            width: 100%;
                            background: transparent;
                            font-family: inherit;
                        }
                        .custom-calendar-wrapper .react-calendar__navigation {
                            margin-bottom: 0.5rem;
                            display: flex;
                            align-items: center;
                        }
                        .custom-calendar-wrapper .react-calendar__navigation button {
                            min-width: 32px;
                            background: transparent;
                            border-radius: 6px;
                            font-size: 0.875rem;
                            font-weight: 600;
                            color: #1e293b;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .custom-calendar-wrapper .react-calendar__navigation button:hover {
                            background-color: #f1f5f9;
                        }
                        .custom-calendar-wrapper .react-calendar__navigation button:disabled {
                            background-color: transparent;
                            color: #cbd5e1;
                        }
                        .custom-calendar-wrapper .react-calendar__month-view__weekdays {
                            font-size: 0.75rem;
                            font-weight: 500;
                            color: #64748b;
                            text-transform: none;
                            abbr {
                                text-decoration: none;
                            }
                        }
                        .custom-calendar-wrapper .react-calendar__month-view__days__day {
                            padding: 0.5rem;
                            font-size: 0.875rem;
                            border-radius: 9999px;
                            aspect-ratio: 1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #334155;
                            margin: 2px 0;
                        }
                        .custom-calendar-wrapper .react-calendar__month-view__days__day--weekend {
                            color: #334155;
                        }
                        .custom-calendar-wrapper .react-calendar__month-view__days__day--neighboringMonth {
                            color: #cbd5e1;
                        }
                        .custom-calendar-wrapper .react-calendar__tile:disabled {
                            background-color: transparent;
                            color: #cbd5e1;
                        }
                        .custom-calendar-wrapper .react-calendar__tile:enabled:hover,
                        .custom-calendar-wrapper .react-calendar__tile:enabled:focus {
                            background-color: #f1f5f9;
                            border-radius: 9999px;
                        }
                        .custom-calendar-wrapper .react-calendar__tile--now {
                            background: transparent;
                            color: #4f46e5;
                            font-weight: 600;
                        }
                        .custom-calendar-wrapper .react-calendar__tile--now:hover {
                            background-color: #f1f5f9;
                        }
                        .custom-calendar-wrapper .react-calendar__tile--active {
                            background-color: #4f46e5 !important;
                            color: white !important;
                            font-weight: 500;
                            border-radius: 9999px;
                        }
                        .custom-calendar-wrapper .react-calendar__month-view__days {
                            /* Removed grid to allow native flex margin-inline-start for first day offset */
                        }
                        .custom-calendar-wrapper .react-calendar__tile {
                            /* Keep native flex basis */
                            padding: 0.5rem;
                        }
                    `}} />
                </div>
            )}
        </div>
    );
}
