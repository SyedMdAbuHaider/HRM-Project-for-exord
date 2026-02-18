
import { OFFICE_CONFIG } from './constants';

/**
 * Calculates distance between two coordinates using Haversine formula
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Validates if an IP address belongs to the office subnet
 */
export const isOfficeIp = (ip: string): boolean => {
  return ip.startsWith(OFFICE_CONFIG.IP_SUBNET);
};

/**
 * Validates geo-fencing requirements
 */
export const isWithinOfficeRadius = (lat: number, lng: number): boolean => {
  const dist = calculateDistance(
    lat,
    lng,
    OFFICE_CONFIG.LOCATION.lat,
    OFFICE_CONFIG.LOCATION.lng
  );
  return dist <= OFFICE_CONFIG.RADIUS_METERS;
};

/**
 * Formats numbers into Bangladeshi Taka (TK/৳)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('BDT', '৳');
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
