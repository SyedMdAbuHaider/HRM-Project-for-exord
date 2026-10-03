import { db } from '../db/pool.js';

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function ipv4ToInt(ip) {
  const p = String(ip || '').split('.').map(Number);
  if (p.length !== 4 || p.some(Number.isNaN)) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function ipInCidr(ip, cidr) {
  const [base, bitsText] = String(cidr).split('/');
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  const bits = bitsText === undefined ? 32 : Number(bitsText);
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

function isAllowedIp(ip, cidrs) {
  return (cidrs || []).some(cidr => ipInCidr(ip, cidr));
}

export async function recordAttendance({ employeeId, type, timestamp, location, ipAddress, deviceId, appVersion, clientEventId }) {
  const { rows: employees } = await db.query(
    `SELECT e.id, e.status, e.weekend_days, e.unit_id,
            u.latitude, u.longitude, u.radius_meters, u.allowed_ip_cidrs
     FROM employees e
     LEFT JOIN units u ON u.id = e.unit_id
     WHERE e.id = $1`,
    [employeeId]
  );

  const employee = employees[0];
  if (!employee || employee.status !== 'ACTIVE') {
    throw Object.assign(new Error('Employee is not active'), { status: 403 });
  }

  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const accuracy = Number(location?.accuracy ?? 9999);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw Object.assign(new Error('Valid location is required'), { status: 400 });
  }

  const trustedIp = isAllowedIp(ipAddress, employee.allowed_ip_cidrs);
  const hasUnitLocation = employee.latitude !== null && employee.longitude !== null;
  const distance = hasUnitLocation
    ? distanceMeters(lat, lng, Number(employee.latitude), Number(employee.longitude))
    : null;

  if (!trustedIp && (!hasUnitLocation || distance > Number(employee.radius_meters))) {
    throw Object.assign(new Error('Attendance location/network policy failed'), {
      status: 403,
      code: 'ATTENDANCE_GEOFENCE_FAILED',
      details: { distanceMeters: distance, accuracyMeters: accuracy }
    });
  }

  const occurredAt = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw Object.assign(new Error('Invalid attendance timestamp'), { status: 400 });
  }

  const { rows: policyRows } = await db.query(
    `SELECT check_in_time, grace_minutes
     FROM attendance_policy
     WHERE active = true
     ORDER BY created_at DESC
     LIMIT 1`
  );
  const policy = policyRows[0];
  let isLate = false;
  let lateMinutes = 0;

  if (type === 'CHECK_IN' && policy) {
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(occurredAt);
    const [h, m] = local.split(':').map(Number);
    const [ph, pm] = String(policy.check_in_time).slice(0, 5).split(':').map(Number);
    const actual = h * 60 + m;
    const scheduled = ph * 60 + pm;
    lateMinutes = Math.max(0, actual - scheduled - Number(policy.grace_minutes || 0));
    isLate = lateMinutes > 0;
  }

  const { rows } = await db.query(
    `INSERT INTO attendance
      (employee_id, type, occurred_at, location, ip_address, device_id, app_version,
       is_late, late_minutes, client_event_id, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
     ON CONFLICT (employee_id, client_event_id)
     DO UPDATE SET synced_at = now()
     RETURNING *`,
    [
      employeeId, type, occurredAt, JSON.stringify({ lat, lng, accuracy }),
      ipAddress || null, deviceId || null, appVersion || null,
      isLate, lateMinutes, clientEventId || null
    ]
  );

  return rows[0];
}