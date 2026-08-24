import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

const HOURS = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const getPrev = (arr, val) => arr[(arr.indexOf(val) - 1 + arr.length) % arr.length];
const getNext = (arr, val) => arr[(arr.indexOf(val) + 1) % arr.length];

export default function TimePicker({ value, onChange, placeholder, disabled }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Internal state for the picker (12-hour format)
    const [hour, setHour] = useState('12');
    const [minute, setMinute] = useState('00');
    const [ampm, setAmpm] = useState('AM');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync from external 24h value (HH:mm) to internal 12h state
    useEffect(() => {
        if (!value) {
            setHour('12');
            setMinute('00');
            setAmpm('AM');
            return;
        }
        const [h, m] = value.split(':');
        let hInt = parseInt(h, 10);
        const mInt = parseInt(m, 10);
        
        const isPm = hInt >= 12;
        if (hInt === 0) hInt = 12;
        else if (hInt > 12) hInt -= 12;

        setHour(String(hInt).padStart(2, '0'));
        setMinute(String(mInt).padStart(2, '0'));
        setAmpm(isPm ? 'PM' : 'AM');
    }, [value, isOpen]);

    // Construct 24h format from 12h state
    const updateExternalValue = (newH, newM, newA) => {
        let hInt = parseInt(newH, 10);
        if (newA === 'PM' && hInt < 12) hInt += 12;
        if (newA === 'AM' && hInt === 12) hInt = 0;
        
        const formatted24h = `${String(hInt).padStart(2, '0')}:${newM}`;
        if (onChange) {
            onChange({ target: { value: formatted24h } });
        }
    };

    const handleHourChange = (newH) => { setHour(newH); updateExternalValue(newH, minute, ampm); };
    const handleMinuteChange = (newM) => { setMinute(newM); updateExternalValue(hour, newM, ampm); };
    const handleAmpmChange = (newA) => { if (!newA) return; setAmpm(newA); updateExternalValue(hour, minute, newA); };

    // Helper to format the display value
    const displayValue = value ? (() => {
        const [h, m] = value.split(':');
        let hInt = parseInt(h, 10);
        const isPm = hInt >= 12;
        if (hInt === 0) hInt = 12;
        else if (hInt > 12) hInt -= 12;
        return `${String(hInt).padStart(2, '0')}:${m} ${isPm ? 'PM' : 'AM'}`;
    })() : '';

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
                    <Clock size={16} />
                </div>
                <div className={`flex-1 truncate ${!displayValue ? 'text-[var(--vz-text-muted)]' : ''}`}>
                    {displayValue || placeholder || 'Select time'}
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg w-[320px] p-4 flex gap-4 items-center justify-center select-none">
                    {/* Hour Column */}
                    <div className="flex flex-col items-center flex-1 gap-3">
                        <div className="text-[13px] font-medium text-slate-500 mb-1">Hour</div>
                        <button type="button" onClick={() => handleHourChange(getPrev(HOURS, hour))} className="text-primary hover:bg-slate-50 p-1 rounded-md transition-colors">
                            <ChevronUp size={20} />
                        </button>
                        <div className="text-[15px] font-medium text-slate-700 cursor-pointer hover:text-primary transition-colors" onClick={() => handleHourChange(getPrev(HOURS, hour))}>
                            {getPrev(HOURS, hour)}
                        </div>
                        <div className="bg-blue-50 text-blue-600 font-semibold text-lg py-2 px-5 rounded-lg border border-blue-100">
                            {hour}
                        </div>
                        <div className="text-[15px] font-medium text-slate-700 cursor-pointer hover:text-primary transition-colors" onClick={() => handleHourChange(getNext(HOURS, hour))}>
                            {getNext(HOURS, hour)}
                        </div>
                        <button type="button" onClick={() => handleHourChange(getNext(HOURS, hour))} className="text-primary hover:bg-slate-50 p-1 rounded-md transition-colors">
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    <div className="text-slate-400 font-bold text-xl mt-6">:</div>

                    {/* Minute Column */}
                    <div className="flex flex-col items-center flex-1 gap-3">
                        <div className="text-[13px] font-medium text-slate-500 mb-1">Minute</div>
                        <button type="button" onClick={() => handleMinuteChange(getPrev(MINUTES, minute))} className="text-primary hover:bg-slate-50 p-1 rounded-md transition-colors">
                            <ChevronUp size={20} />
                        </button>
                        <div className="text-[15px] font-medium text-slate-700 cursor-pointer hover:text-primary transition-colors" onClick={() => handleMinuteChange(getPrev(MINUTES, minute))}>
                            {getPrev(MINUTES, minute)}
                        </div>
                        <div className="bg-blue-50 text-blue-600 font-semibold text-lg py-2 px-5 rounded-lg border border-blue-100">
                            {minute}
                        </div>
                        <div className="text-[15px] font-medium text-slate-700 cursor-pointer hover:text-primary transition-colors" onClick={() => handleMinuteChange(getNext(MINUTES, minute))}>
                            {getNext(MINUTES, minute)}
                        </div>
                        <button type="button" onClick={() => handleMinuteChange(getNext(MINUTES, minute))} className="text-primary hover:bg-slate-50 p-1 rounded-md transition-colors">
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    {/* AM/PM Column */}
                    <div className="flex flex-col items-center flex-1 gap-3 ml-2">
                        <div className="text-[13px] font-medium text-slate-500 mb-1">AM/PM</div>
                        <button type="button" onClick={() => handleAmpmChange(ampm === 'PM' ? 'AM' : null)} className={`text-primary p-1 rounded-md transition-colors ${ampm === 'AM' ? 'invisible' : 'hover:bg-slate-50'}`}>
                            <ChevronUp size={20} />
                        </button>
                        <div className="h-6 flex items-center justify-center text-[15px] font-medium text-slate-700 cursor-pointer hover:text-primary transition-colors" onClick={() => handleAmpmChange(ampm === 'PM' ? 'AM' : null)}>
                            {ampm === 'PM' ? 'AM' : ''}
                        </div>
                        <div className="bg-blue-50 text-blue-600 font-semibold text-lg py-2 px-4 rounded-lg border border-blue-100">
                            {ampm}
                        </div>
                        <div className="h-6 flex items-center justify-center text-[15px] font-medium text-slate-700 cursor-pointer hover:text-primary transition-colors" onClick={() => handleAmpmChange(ampm === 'AM' ? 'PM' : null)}>
                            {ampm === 'AM' ? 'PM' : ''}
                        </div>
                        <button type="button" onClick={() => handleAmpmChange(ampm === 'AM' ? 'PM' : null)} className={`text-primary p-1 rounded-md transition-colors ${ampm === 'PM' ? 'invisible' : 'hover:bg-slate-50'}`}>
                            <ChevronDown size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
