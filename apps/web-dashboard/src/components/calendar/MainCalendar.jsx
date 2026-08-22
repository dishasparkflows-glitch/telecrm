import React, { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Video, ExternalLink, Clock, User, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

const localizer = momentLocalizer(moment);

export default function MainCalendar({ 
    events, 
    isLoading, 
    currentView, 
    currentDate,
    onViewChange,
    onNavigate,
    onDateChange 
}) {
    const navigate = useNavigate();
    const [selectedEventModal, setSelectedEventModal] = useState(null);

    // Map FullCalendar formatted events to react-big-calendar format
    const rbcEvents = events.map(evt => ({
        id: evt.id,
        title: evt.title,
        start: new Date(evt.start),
        end: new Date(evt.end),
        resource: evt.extendedProps,
        // Carry over colors if they exist
        backgroundColor: evt.backgroundColor,
        borderColor: evt.borderColor,
        textColor: evt.textColor
    }));

    const handleSelectEvent = (event) => {
        setSelectedEventModal(event);
    };

    const handleRangeChange = (range) => {
        if (onDateChange) {
            if (Array.isArray(range)) {
                onDateChange({ from: range[0].toISOString(), to: range[range.length - 1].toISOString() });
            } else {
                onDateChange({ from: range.start.toISOString(), to: range.end.toISOString() });
            }
        }
    };

    const EventComponent = ({ event }) => {
        return (
            <div className="flex flex-col h-full overflow-hidden px-1 py-0.5">
                <div className="text-[11px] font-semibold truncate leading-tight">{event.title}</div>
                {event.resource?.type === 'meeting' && (
                    <div className="text-[10px] opacity-80 mt-0.5 truncate leading-tight">
                        {event.resource.data?.leadId?.name || 'Internal'}
                    </div>
                )}
            </div>
        );
    };

    const eventPropGetter = (event) => {
        return {
            style: {
                backgroundColor: event.backgroundColor || '#eff6ff',
                color: event.textColor || '#1d4ed8',
                borderRadius: '4px',
                border: 'none',
                borderLeft: `3px solid ${event.borderColor || '#3b82f6'}`,
                padding: '0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }
        };
    };

    return (
        <div className="h-full w-full bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative [&_.rbc-time-view]:border-slate-200 [&_.rbc-time-header.rbc-overflowing]:border-r-0 [&_.rbc-header]:border-slate-200 [&_.rbc-header]:font-medium [&_.rbc-header]:text-slate-600 [&_.rbc-header]:text-xs [&_.rbc-header]:py-2 [&_.rbc-day-bg]:border-slate-200 [&_.rbc-timeslot-group]:border-slate-200 [&_.rbc-time-content]:border-slate-200 [&_.rbc-event]:bg-transparent [&_.rbc-event]:p-0 [&_.rbc-month-view]:border-slate-200 [&_.rbc-month-row]:border-slate-200 [&_.rbc-day-bg]:border-slate-200">
            {isLoading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-500">Loading events...</span>
                </div>
            )}
            <Calendar
                localizer={localizer}
                events={rbcEvents}
                startAccessor="start"
                endAccessor="end"
                view={currentView}
                date={currentDate}
                onView={onViewChange}
                onNavigate={onNavigate}
                toolbar={false}
                step={30}
                timeslots={2}
                onSelectEvent={handleSelectEvent}
                onRangeChange={handleRangeChange}
                components={{
                    event: EventComponent
                }}
                eventPropGetter={eventPropGetter}
                style={{ height: 'calc(100vh - 220px)' }}
            />

            <Modal 
                isOpen={!!selectedEventModal} 
                onClose={() => setSelectedEventModal(null)}
                size="sm"
            >
                {selectedEventModal && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <div 
                                className="w-3.5 h-3.5 rounded-full mt-1.5 shrink-0" 
                                style={{ backgroundColor: selectedEventModal.borderColor || '#3b82f6' }} 
                            />
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">{selectedEventModal.title}</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    {format(selectedEventModal.start, 'EEEE, MMMM d')} ⋅ {format(selectedEventModal.start, 'h:mma')} – {format(selectedEventModal.end, 'h:mma')}
                                </p>
                            </div>
                        </div>

                        {selectedEventModal.resource?.type === 'meeting' && selectedEventModal.resource.data?.meeting?.meetingLink && (
                            <div className="flex items-center gap-3 mt-2">
                                <Video className="text-primary w-5 h-5 shrink-0 ml-[-2px]" />
                                <div className="flex flex-col items-start gap-1">
                                    <Button 
                                        onClick={() => window.open(selectedEventModal.resource.data.meeting.meetingLink, '_blank')}
                                        className="bg-primary hover:bg-primary/90 text-white !py-2 !px-4"
                                    >
                                        Join with Google Meet
                                    </Button>
                                    <a href={selectedEventModal.resource.data.meeting.meetingLink} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:underline truncate max-w-[280px]">
                                        {selectedEventModal.resource.data.meeting.meetingLink}
                                    </a>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 mt-4 text-sm text-slate-700">
                            {selectedEventModal.resource?.data?.leadId && (
                                <div className="flex items-center gap-3">
                                    <User className="w-4 h-4 text-slate-400" />
                                    <span>{selectedEventModal.resource.data.leadId.name} (Guest)</span>
                                </div>
                            )}
                            {selectedEventModal.resource?.data?.meeting?.description && (
                                <div className="flex items-start gap-3">
                                    <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                    <span className="text-slate-600 whitespace-pre-wrap">{selectedEventModal.resource.data.meeting.description}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span>{selectedEventModal.resource?.data?.hostId?.name || 'Disha Radadiya'}</span>
                            </div>
                        </div>

                        <Modal.Footer className="mt-4 !mb-0 !mx-0">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    if (selectedEventModal.resource?.type === 'meeting') {
                                        navigate(`/meetings/${selectedEventModal.resource.data._id}`);
                                    }
                                }}
                                className="w-full justify-center"
                            >
                                <ExternalLink size={16} className="mr-2" />
                                View Full Details
                            </Button>
                        </Modal.Footer>
                    </div>
                )}
            </Modal>
        </div>
    );
}
