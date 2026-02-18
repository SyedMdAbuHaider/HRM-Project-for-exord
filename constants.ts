
export const OFFICE_CONFIG = {
  IP_SUBNET: '192.168.1',
  RADIUS_METERS: 100,
  LOCATION: {
    lat: 40.7128,
    lng: -74.0060,
  },
  NAME: 'Exord HQ'
};

export const SECURITY_RULES = {
  MAX_LOGIN_ATTEMPTS: 5,
  SESSION_TIMEOUT_MINS: 60,
  TRACKING_INTERVAL_MS: 300000, // 5 minutes
};

export const DEPARTMENTS = [
  'Network Operations',
  'Customer Support',
  'Sales',
  'Administration',
  'Field Engineering'
];

export const LEAVE_TYPES = [
  'Annual',
  'Sick',
  'Maternity/Paternity',
  'Unpaid',
  'Bereavement'
];
