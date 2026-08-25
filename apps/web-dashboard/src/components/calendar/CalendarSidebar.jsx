import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Filter, ChevronRight, Check } from 'lucide-react';

export default function CalendarSidebar({ 
    selectedDate, 
    onDateSelect, 
    filters, 
    onFilterChange, 
    upcomingEvents 
}) {
    const filterOptions = [
        { key: 'meetings', label: 'Meetings', color: 'bg-blue-500' },
        { key: 'tasks', label: 'Tasks', color: 'bg-green-500' },
        { key: 'followups', label: 'Follow-ups', color: 'bg-amber-500' }
    ];

    const toggleFilter = (key) => {
        onFilterChange({
            ...filters,
            [key]: !filters[key]
        });
    };

    return (
        <div className="w-72 flex flex-col gap-6 h-full overflow-y-auto pr-2 custom-scrollbar">
            {/* Filter Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <Filter size={16} className="text-slate-500"/> Filters
                    </h3>
                </div>
                
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Calendars</p>
                    <div className="grid grid-cols-2 gap-3">
                        {filterOptions.map((opt) => (
                            <label 
                                key={opt.key} 
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={(e) => {
                                    e.preventDefault();
                                    toggleFilter(opt.key);
                                }}
                            >
                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${filters[opt.key] ? opt.color + ' border-transparent text-white' : 'border-slate-300 bg-slate-50 group-hover:border-primary'}`}>
                                    {filters[opt.key] && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span className="text-xs font-medium text-slate-700">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mini Calendar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mini-calendar-wrapper">
                <Calendar
                    onChange={onDateSelect}
                    value={selectedDate}
                    className="w-full border-0 text-sm font-medium"
                    navigationLabel={({ date }) => `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`}
                    prev2Label={null}
                    next2Label={null}
                />
            </div>

            {/* Upcoming Meetings */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex-1">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Upcoming Meetings</h3>
                </div>
                <div className="space-y-4">
                    {upcomingEvents && upcomingEvents.length > 0 ? (
                        upcomingEvents.slice(0, 4).map((evt) => (
                            <div key={evt.id} className="relative pl-4">
                                <div className={`absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: evt.textColor }}></div>
                                <p className="text-xs font-semibold text-slate-900 truncate">{evt.title}</p>
                                {evt.extendedProps?.data?.leadId?.name && (
                                    <p className="text-xs text-slate-500 truncate">{evt.extendedProps.data.leadId.name}</p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    {new Date(evt.start).toLocaleDateString()} • {new Date(evt.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-500 italic">No upcoming meetings</p>
                    )}
                </div>
            </div>
        </div>
    );
}
