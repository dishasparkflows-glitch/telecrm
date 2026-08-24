export const ROLES = {
  SUPER_ADMIN: 'super-admin'
};

export const REMINDER_OPTIONS = [
  { label: "At time of activity", offsetMinutes: 0 },
  { label: "5 minutes before", offsetMinutes: 5 },
  { label: "15 minutes before", offsetMinutes: 15 },
  { label: "30 minutes before", offsetMinutes: 30 },
  { label: "1 hour before", offsetMinutes: 60 },
  { label: "2 hours before", offsetMinutes: 120 },
  { label: "1 day before", offsetMinutes: 1440 },
  { label: "2 days before", offsetMinutes: 2880 }
];
