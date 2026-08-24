import React, { useState, useMemo } from 'react';
import CalendarSidebar from '../../components/calendar/CalendarSidebar';
import MainCalendar from '../../components/calendar/MainCalendar';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import Button from '../../components/ui/Button';
import { Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { startOfWeek, endOfWeek, format, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, startOfDay, endOfDay } from 'date-fns';

const ViewButton = ({ view, label, currentView, setCurrentView }) => (
    <button 
        onClick={() => setCurrentView(view)}
        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            currentView === view 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
        }`}
    >
        {label}
    </button>
);

export default function Calendar() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('week');
    
    const dateRange = useMemo(() => {
        let from, to;
        if (currentView === 'day') {
            from = startOfDay(selectedDate);
            to = endOfDay(selectedDate);
        } else if (currentView === 'week') {
            from = startOfWeek(selectedDate, { weekStartsOn: 1 });
            to = endOfWeek(selectedDate, { weekStartsOn: 1 });
        } else {
            from = startOfMonth(selectedDate);
            to = endOfMonth(selectedDate);
        }
        return {
            from: from.toISOString(),
            to: to.toISOString()
        };
    }, [selectedDate, currentView]);

    const [filters, setFilters] = useState({
        meetings: true,
        tasks: true,
        followups: true
    });

    const { events, isLoading } = useCalendarEvents(dateRange);

    const filteredEvents = useMemo(() => {
        return events.filter(evt => {
            if (evt.extendedProps.type === 'task' && !filters.tasks) return false;
            if (evt.extendedProps.type === 'followup' && !filters.followups) return false;
            if (evt.extendedProps.type === 'meeting' && !filters.meetings) return false;
            return true;
        });
    }, [events, filters]);

    const upcomingEvents = useMemo(() => {
        const now = new Date();
        return filteredEvents
            .filter(e => new Date(e.start) >= now)
            .sort((a, b) => new Date(a.start) - new Date(b.start));
    }, [filteredEvents]);

    const handleNavigate = (action) => {
        let newDate = new Date(selectedDate);
        if (action === 'TODAY') {
            newDate = new Date();
        } else if (action === 'PREV') {
            if (currentView === 'month') newDate = addMonths(newDate, -1);
            else if (currentView === 'week') newDate = addWeeks(newDate, -1);
            else newDate = addDays(newDate, -1);
        } else if (action === 'NEXT') {
            if (currentView === 'month') newDate = addMonths(newDate, 1);
            else if (currentView === 'week') newDate = addWeeks(newDate, 1);
            else newDate = addDays(newDate, 1);
        }
        setSelectedDate(newDate);
    };

    const getFormattedDateRange = () => {
        if (currentView === 'day') {
            return format(selectedDate, 'dd MMM yyyy');
        } else if (currentView === 'week') {
            const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
            const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
            if (start.getMonth() !== end.getMonth()) {
                return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`;
            }
            return `${format(start, 'dd')} - ${format(end, 'dd MMM yyyy')}`;
        } else {
            return format(selectedDate, 'MMMM yyyy');
        }
    };

    return (
        <div className="flex flex-col h-full -m-6 p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <button onClick={() => handleNavigate('TODAY')} className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 border-r border-slate-200">Today</button>
                            <button onClick={() => handleNavigate('PREV')} className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 border-r border-slate-200">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => handleNavigate('NEXT')} className="px-2 py-1.5 text-slate-600 hover:bg-slate-50">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <span className="text-sm font-semibold text-slate-800 w-[140px]">
                            {getFormattedDateRange()}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200/50">
                        <ViewButton view="day" label="Day" currentView={currentView} setCurrentView={setCurrentView} />
                        <ViewButton view="week" label="Week" currentView={currentView} setCurrentView={setCurrentView} />
                        <ViewButton view="month" label="Month" currentView={currentView} setCurrentView={setCurrentView} />
                        <ViewButton view="agenda" label="Agenda" currentView={currentView} setCurrentView={setCurrentView} />
                    </div>

                    <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 shadow-sm">
                            <Filter size={14} /> Filter
                        </button>
                        <Button size="sm">
                            <Plus size={14} className="mr-1" /> Schedule Meeting
                        </Button>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 flex gap-6 overflow-hidden h-[calc(100vh-140px)]">
                <div className="w-[300px] shrink-0 h-full overflow-y-auto hidden lg:block">
                    <CalendarSidebar 
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        filters={filters}
                        onFilterChange={setFilters}
                        upcomingEvents={upcomingEvents}
                    />
                </div>
                <div className="flex-1 h-full min-w-0">
                    <MainCalendar 
                        events={filteredEvents}
                        isLoading={isLoading}
                        currentView={currentView}
                        currentDate={selectedDate}
                        onViewChange={setCurrentView}
                        onNavigate={(newDate) => setSelectedDate(newDate)}
                    />
                </div>
            </div>
        </div>
    );
}
