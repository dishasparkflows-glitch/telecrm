import React, { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Video, ExternalLink, Clock, User, FileText, Calendar as CalendarIcon, MapPin } from 'lucide-react';
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
    const [popoverAnchor, setPopoverAnchor] = useState(null);

    const getEventColor = (resource) => {
        if (resource?.type === 'task') return '#33b679';
        if (resource?.type === 'followup') return '#f6bf26';
        return '#039be5'; // default blue
    };

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

    const handleSelectEvent = (event, e) => {
        setSelectedEventModal(event);
        if (e && e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            let left = rect.right + 10;
            let top = Math.max(10, rect.top - 20); // slightly above the event
            
            // Adjust for right edge
            if (left + 350 > window.innerWidth) {
                left = Math.max(10, rect.left - 350);
            }
            // Adjust for bottom edge
            if (top + 300 > window.innerHeight) {
                top = Math.max(10, window.innerHeight - 320);
            }

            setPopoverAnchor({ top, left });
        } else if (e && e.clientX) {
            setPopoverAnchor({ top: Math.max(10, e.clientY - 50), left: e.clientX + 20 });
        } else {
            setPopoverAnchor({ top: window.innerHeight / 2 - 150, left: window.innerWidth / 2 - 160 });
        }
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
            <div className="flex flex-col h-full overflow-hidden">
                <div className="text-[11px] font-medium truncate leading-tight text-inherit">{event.title}</div>
            </div>
        );
    };

    const eventPropGetter = (event) => {
        const bgColor = getEventColor(event.resource);
        return {
            style: {
                backgroundColor: bgColor,
                color: bgColor === '#f6bf26' ? '#202124' : '#ffffff',
                borderRadius: '4px',
                border: 'none',
                padding: '2px 4px',
                boxShadow: 'none',
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

            {selectedEventModal && popoverAnchor && (
                <>
                    <div className="fixed inset-0 z-[40]" onClick={() => { setSelectedEventModal(null); setPopoverAnchor(null); }} />
                    <div 
                        className="fixed z-[50] bg-white rounded-xl shadow-2xl border border-slate-200 p-5 w-[340px] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
                        style={{ top: popoverAnchor.top, left: popoverAnchor.left }}
                    >
                        {/* Top Action Bar */}
                        <div className="flex justify-end -mt-1 -mr-1 mb-[-8px]">
                            <button 
                                onClick={() => { setSelectedEventModal(null); setPopoverAnchor(null); }}
                                className="text-slate-500 hover:text-slate-800 p-2 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center"
                                title="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>

                        <div className="flex items-start gap-3">
                            <div 
                                className="w-3.5 h-3.5 rounded-sm mt-1.5 shrink-0" 
                                style={{ backgroundColor: getEventColor(selectedEventModal.resource) }} 
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-slate-900 truncate pr-2">{selectedEventModal.title}</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    {format(selectedEventModal.start, 'EEEE, MMMM d')} ⋅ {format(selectedEventModal.start, 'h:mma')} – {format(selectedEventModal.end, 'h:mma')}
                                </p>
                            </div>
                        </div>

                        {selectedEventModal.resource?.type === 'meeting' && (() => {
                            const data = selectedEventModal.resource.data;
                            const meetingLink = data?.conference?.meetingUrl || data?.meeting?.link;
                            const isOnline = !data?.meeting?.meetingType || data?.meeting?.meetingType === 'online';
                            
                            return (
                                <>
                                    {isOnline && meetingLink && (
                                        <div className="flex items-center gap-3 mt-2">
                                            <Video className="text-[#1a73e8] w-5 h-5 shrink-0 ml-[-2px]" />
                                            <div className="flex flex-col items-start gap-1 w-full min-w-0">
                                                <Button 
                                                    onClick={() => window.open(meetingLink, '_blank')}
                                                    className="bg-[#1a73e8] hover:bg-[#1557b0] text-white !py-1.5 !px-4 rounded-full font-medium shadow-none w-full justify-center"
                                                >
                                                    Join with Google Meet
                                                </Button>
                                                <a href={meetingLink} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:underline truncate w-full block">
                                                    {meetingLink}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {data?.meeting?.meetingType === 'offline' && data?.meeting?.location && (
                                        <div className="flex items-center gap-3 mt-2">
                                            <MapPin className="text-slate-500 w-5 h-5 shrink-0 ml-[-2px]" />
                                            <div className="flex flex-col items-start gap-1 w-full min-w-0">
                                                <span className="text-sm font-medium text-slate-800">Meeting Location</span>
                                                <span className="text-xs text-slate-500 whitespace-pre-wrap break-words">{data.meeting.location}</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        <div className="flex flex-col gap-3 mt-4 text-sm text-slate-700">
                            {selectedEventModal.resource?.data?.leadId && (
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 text-slate-500 shrink-0 ml-[-2px]" />
                                    <span className="truncate">{selectedEventModal.resource.data.leadId.name} </span>
                                </div>
                            )}
                            {selectedEventModal.resource?.data?.meeting?.description && (
                                <div className="flex items-start gap-3">
                                    <FileText className="w-5 h-5 text-slate-500 shrink-0 ml-[-2px] mt-0.5" />
                                    <span className="text-slate-600 whitespace-pre-wrap break-words">{selectedEventModal.resource.data.meeting.description}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <CalendarIcon className="w-5 h-5 text-slate-500 shrink-0 ml-[-2px]" />
                                <span className="truncate">{selectedEventModal.resource?.data?.hostId?.name || 'Disha Radadiya'}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                    if (selectedEventModal.resource?.type === 'meeting') {
                                        navigate(`/meetings/${selectedEventModal.resource.data._id}`);
                                    } else if (selectedEventModal.resource?.type === 'followup') {
                                        const leadId = selectedEventModal.resource.data.leadId?._id || selectedEventModal.resource.data.leadId;
                                        if (leadId) {
                                            navigate(`/leads/${leadId}`);
                                        }
                                    } else if (selectedEventModal.resource?.type === 'task') {
                                        const leadId = selectedEventModal.resource.data.leadId?._id || selectedEventModal.resource.data.leadId;
                                        if (leadId) {
                                            navigate(`/leads/${leadId}`);
                                        } else {
                                            navigate(`/tasks`);
                                        }
                                    }
                                }}
                                className="!py-1.5"
                            >
                                <ExternalLink size={14} className="mr-1.5" />
                                View Full Details
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
