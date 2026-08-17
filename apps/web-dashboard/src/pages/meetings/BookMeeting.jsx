import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useGetPublicBookingLinkQuery, useBookPublicMeetingMutation, useGetPublicBookingAvailabilityQuery } from '../../features/meetings/meetingApi'
import { Calendar, Clock, Video, User, Mail, Phone, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'

export default function BookMeeting() {
  const { slug } = useParams()
  const toast = useToast()
  const { data, isLoading, isError } = useGetPublicBookingLinkQuery(slug)
  const [bookMeeting, { isLoading: isBooking }] = useBookPublicMeetingMutation()

  const [step, setStep] = useState(1) // 1: Date/Time, 2: Details, 3: Success
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [selectedDuration, setSelectedDuration] = useState(null)
  
  const { data: availabilityData, isFetching: isFetchingAvailability } = useGetPublicBookingAvailabilityQuery(
    { slug, date: selectedDate, duration: selectedDuration },
    { skip: !selectedDate || !selectedDuration }
  )
  
  const [guestForm, setGuestForm] = useState({ name: '', email: '', phone: '' })

  const link = data?.data

  // Generate slots for the selected date
  const timeSlots = useMemo(() => {
    if (!link || !selectedDate || !selectedDuration) return []
    const { startTime, endTime, days } = link.availability
    
    // Check if selected date is an available day
    const dateObj = new Date(`${selectedDate}T12:00:00`) // use midday to avoid timezone shifts
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    if (days && !days.includes(dayOfWeek)) {
      return []
    }

    let existingMeetings = availabilityData?.data?.existingMeetings || []
    let googleBusySlots = availabilityData?.data?.googleBusySlots || []

    const slots = []
    let current = new Date(`${selectedDate}T${startTime}:00`)
    const end = new Date(`${selectedDate}T${endTime}:00`)
    const slotInterval = link.slotInterval || 15

    while (current < end) {
      const slotEnd = new Date(current.getTime() + selectedDuration * 60000)
      
      // check internal overlaps
      const internalOverlap = existingMeetings.some(m => {
        const mStart = new Date(m.scheduledAt)
        const mEnd = new Date(mStart.getTime() + m.duration * 60000)
        return current < mEnd && slotEnd > mStart
      })

      // check google overlaps
      const googleOverlap = googleBusySlots.some(busy => {
        const busyStart = new Date(busy.start)
        const busyEnd = new Date(busy.end)
        return current < busyEnd && slotEnd > busyStart
      })

      if (!internalOverlap && !googleOverlap && slotEnd <= end) {
        slots.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
      }
      current = new Date(current.getTime() + slotInterval * 60000)
    }
    return slots
  }, [selectedDate, selectedDuration, link, availabilityData])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)]">
        <div className="animate-pulse text-primary font-medium text-lg">Loading...</div>
      </div>
    )
  }

  if (isError || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)] p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-4">
          <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--vz-heading)]">Link Unavailable</h2>
          <p className="text-[var(--vz-text-muted)]">This booking link is no longer active or does not exist.</p>
        </Card>
      </div>
    )
  }

  // Pre-select first duration if available
  if (!selectedDuration && link.durationOptions?.length > 0) {
    setSelectedDuration(link.durationOptions[0])
  }

  const handleBook = async (e) => {
    e.preventDefault()
    if (!guestForm.name || !guestForm.email) {
      toast('Name and email are required', 'error')
      return
    }

    try {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
      
      await bookMeeting({
        slug,
        meeting: { title: `${link.title} with ${guestForm.name}`, scheduledAt, duration: selectedDuration },
        guest: guestForm
      }).unwrap()
      
      setStep(3)
    } catch (err) {
      toast(err?.data?.message || 'Failed to book meeting. The slot might have been taken.', 'error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a] p-4 font-sans">
      <div className="max-w-4xl w-full bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-slate-800">
        
        {/* Left Column: Details */}
        <div className="md:w-1/3 bg-slate-50 dark:bg-slate-900/50 p-8 border-r border-slate-200 dark:border-slate-800">
          <div className="mb-8">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
              <Calendar size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{link.title}</h1>
            {link.description && <p className="text-slate-500 dark:text-slate-400 text-sm">{link.description}</p>}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
              <Clock size={18} className="text-primary" />
              <span className="font-medium">{selectedDuration || link.durationOptions?.[0]} min</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
              <Video size={18} className="text-primary" />
              <span className="font-medium">Web Conference</span>
            </div>
          </div>

          {(selectedDate || selectedTime) && (
            <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500 mb-1">Selected Time</p>
              <p className="font-bold text-primary">
                {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
                {selectedTime ? ` at ${selectedTime}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Interaction */}
        <div className="md:w-2/3 p-8">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Select a Date & Time</h2>
              
              {link.durationOptions?.length > 1 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">How long would you like to meet?</label>
                  <div className="flex flex-wrap gap-3">
                    {link.durationOptions?.map(dur => (
                      <button
                        key={dur}
                        onClick={() => setSelectedDuration(dur)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          selectedDuration === dur 
                            ? 'border-primary bg-primary text-white shadow-md' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {dur} min
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date</label>
                  <Input 
                    type="date" 
                    value={selectedDate || ''} 
                    onChange={e => { setSelectedDate(e.target.value); setSelectedTime(null); }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                  {!selectedDate && (
                    <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10 text-center">
                      <p className="text-sm text-primary">Please select a date to view available times.</p>
                    </div>
                  )}
                </div>

                {selectedDate && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Time Slots {isFetchingAvailability && <span className="text-xs text-primary font-normal">(Loading...)</span>}
                    </label>
                    <div className="grid grid-cols-2 gap-2 h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {timeSlots.map(time => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`px-3 py-2 text-sm rounded-lg border text-center transition-all ${
                            selectedTime === time 
                              ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary' 
                              : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                      {timeSlots.length === 0 && !isFetchingAvailability && (
                        <div className="col-span-2 text-center text-slate-500 py-8">
                          No slots available.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!selectedDate || !selectedTime}
                  className="w-full md:w-auto"
                >
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <button 
                onClick={() => setStep(1)}
                className="flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-6 transition-colors"
              >
                <ChevronLeft size={16} className="mr-1" /> Back to times
              </button>
              
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Your Details</h2>
              
              <form onSubmit={handleBook} className="space-y-4">
                <Input 
                  label="Full Name" 
                  icon={User} 
                  placeholder="John Doe" 
                  required
                  value={guestForm.name}
                  onChange={e => setGuestForm({ ...guestForm, name: e.target.value })}
                />
                <Input 
                  label="Email Address" 
                  type="email" 
                  icon={Mail} 
                  placeholder="john@example.com" 
                  required
                  value={guestForm.email}
                  onChange={e => setGuestForm({ ...guestForm, email: e.target.value })}
                />
                <Input 
                  label="Phone Number" 
                  type="tel" 
                  icon={Phone} 
                  placeholder="+1 (555) 000-0000" 
                  value={guestForm.phone}
                  onChange={e => setGuestForm({ ...guestForm, phone: e.target.value })}
                />
                
                <div className="pt-6">
                  <Button 
                    type="submit" 
                    className="w-full py-3" 
                    disabled={isBooking}
                  >
                    {isBooking ? 'Confirming...' : 'Confirm Meeting'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500 space-y-4">
              <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">You're booked!</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                A calendar invitation has been sent to your email address.
              </p>
            </div>
          )}
          
        </div>
      </div>
    </div>
  )
}
