import express from 'express';
import ping from 'ping';
import snmp from 'snmp-native';

const router = express.Router();

// ── Standard OIDs ─────────────────────────────────────────────────────────────
const OID_UPTIME     = '1.3.6.1.2.1.1.3.0';
const OID_SYSDESCR   = '1.3.6.1.2.1.1.1.0';
const OID_SYSCONTACT = '1.3.6.1.2.1.1.4.0';
const OID_SYSNAME    = '1.3.6.1.2.1.1.5.0';
const OID_SYSLOC     = '1.3.6.1.2.1.1.6.0';

// Standard HOST-RESOURCES-MIB (works on most SNMP devices including MikroTik)
const OID_CPU_HR     = '1.3.6.1.2.1.25.3.3.1.2.1';  // hrProcessorLoad.1

// hrStorage table — index 1 = RAM on most devices, index 131072 = Flash on MikroTik
// alloc_unit × size_units = total bytes ; alloc_unit × used_units = used bytes
const OID_RAM_ALLOC  = '1.3.6.1.2.1.25.2.3.1.4.1';
const OID_RAM_SIZE   = '1.3.6.1.2.1.25.2.3.1.5.1';
const OID_RAM_USED   = '1.3.6.1.2.1.25.2.3.1.6.1';
const OID_HDD_ALLOC  = '1.3.6.1.2.1.25.2.3.1.4.131072';
const OID_HDD_SIZE   = '1.3.6.1.2.1.25.2.3.1.5.131072';
const OID_HDD_USED   = '1.3.6.1.2.1.25.2.3.1.6.131072';

// ── MikroTik proprietary OIDs (mtxrRouterOS MIB) ─────────────────────────────
const OID_MT_BOARD   = '1.3.6.1.4.1.14988.1.1.7.4.0';  // board model name
const OID_MT_VERSION = '1.3.6.1.4.1.14988.1.1.7.7.0';  // RouterOS version string
const OID_MT_CPU     = '1.3.6.1.4.1.14988.1.1.3.1.0';  // CPU load %  (gauge .1)
const OID_MT_CPU2    = '1.3.6.1.4.1.14988.1.1.3.14.0'; // CPU load % (some fw versions)
const OID_MT_VOLT    = '1.3.6.1.4.1.14988.1.1.3.3.0';  // voltage (decivolts, e.g. 240 = 24.0 V)
const OID_MT_TEMP    = '1.3.6.1.4.1.14988.1.1.3.4.0';  // temperature °C
const OID_MT_TEMP2   = '1.3.6.1.4.1.14988.1.1.3.10.0'; // temperature °C (alt gauge)
const OID_MT_MEMFREE = '1.3.6.1.4.1.14988.1.1.3.5.0';  // free memory (KiB)
const OID_MT_MEMTOT  = '1.3.6.1.4.1.14988.1.1.3.6.0';  // total memory (KiB)
const OID_MT_HFREE   = '1.3.6.1.4.1.14988.1.1.3.7.0';  // free HDD (KiB)
const OID_MT_HTOT    = '1.3.6.1.4.1.14988.1.1.3.8.0';  // total HDD (KiB)

// ── ifTable column bases (index appended per interface) ───────────────────────
const IF_DESCR   = '1.3.6.1.2.1.2.2.1.2';
const IF_SPEED   = '1.3.6.1.2.1.2.2.1.5';
const IF_ADMIN   = '1.3.6.1.2.1.2.2.1.7';
const IF_OPER    = '1.3.6.1.2.1.2.2.1.8';
const IF_IN_OCT  = '1.3.6.1.2.1.2.2.1.10';
const IF_OUT_OCT = '1.3.6.1.2.1.2.2.1.16';
const IF_IN_ERR  = '1.3.6.1.2.1.2.2.1.14';
const IF_OUT_ERR = '1.3.6.1.2.1.2.2.1.20';
const IF_MAX_IDX = 12; // scan interfaces 1–12

// ── Helpers ───────────────────────────────────────────────────────────────────
const toOidObj = oid => ({ oid: oid.replace(/^\./, '').split('.').map(Number) });

const getVal = (binds, oid) => {
  const key = oid.replace(/^\./, '');
  const bind = binds.find(v => v && v.oid && v.oid.join('.') === key);
  if (!bind || bind.type === 'NoSuchObject' || bind.type === 'NoSuchInstance' || bind.type === 'EndOfMibView') return null;
  return bind.value;
};

// ✅ Fixed: snmp-native returns OctetString values as Node.js Buffer objects.
// String(Buffer) → "<Buffer 52 6f ...>" — must use .toString('utf8') instead.
const str = val => {
  if (val == null) return null;
  if (Buffer.isBuffer(val)) return val.toString('utf8').replace(/[\x00-\x1F]/g, ' ').trim().slice(0, 200);
  return String(val).replace(/[\x00-\x1F]/g, ' ').trim().slice(0, 200);
};
const num  = val => (val != null ? Number(val) : null);

const formatUptime = ticks => {
  if (ticks == null) return null;
  const secs  = Math.floor(Number(ticks) / 100);
  const days  = Math.floor(secs / 86400);
  const hrs   = Math.floor((secs % 86400) / 3600);
  const mins  = Math.floor((secs % 3600) / 60);
  const s     = secs % 60;
  return days > 0 ? `${days}d ${hrs}h ${mins}m` : `${hrs}h ${mins}m ${s}s`;
};

const friendlyErr = msg => {
  const m = msg || '';
  if (m.includes('timeout') || m.includes('Timeout'))              return 'Request timed out — host unreachable or wrong port';
  if (m.includes('community') || m.includes('authentication'))     return 'Authentication failed — wrong community string';
  if (m.includes('ECONNREFUSED'))                                   return 'Connection refused on port';
  if (m.includes('EHOSTUNREACH') || m.includes('ENETUNREACH'))     return 'Host unreachable';
  return m;
};

// ── POST /probe/ping ──────────────────────────────────────────────────────────
router.post('/ping', async (req, res) => {
  const { host } = req.body;
  if (!host || typeof host !== 'string' || host.trim() === '') {
    return res.status(400).json({ status: 'error', error: 'host is required' });
  }
  try {
    const result = await ping.promise.probe(host.trim(), { timeout: 8, deadline: 9, min_reply: 1 });
    if (result.alive) {
      return res.json({
        status: 'up',
        latencyMs: result.time !== 'unknown' ? Math.round(parseFloat(result.time)) : undefined,
      });
    } else {
      return res.json({ status: 'down', error: 'No reply from host' });
    }
  } catch (err) {
    console.error('[probe/ping] Error:', err.message);
    return res.json({ status: 'down', error: err.message || 'Ping failed' });
  }
});

// ── POST /probe/snmp  (basic — uptime + sysDescr only) ───────────────────────
router.post('/snmp', (req, res) => {
  const { host, community, port, oid } = req.body;
  if (!host || typeof host !== 'string' || host.trim() === '')
    return res.status(400).json({ status: 'error', error: 'host is required' });
  if (!community || typeof community !== 'string' || community.trim() === '')
    return res.status(400).json({ status: 'error', error: 'community is required' });

  const customOid    = oid && typeof oid === 'string' && oid.trim() !== '' ? oid.trim() : null;
  const oidsToFetch  = customOid ? [customOid, OID_SYSDESCR] : [OID_UPTIME, OID_SYSDESCR];

  let session;
  try {
    session = new snmp.Session({
      host:      host.trim(),
      community: community.trim(),
      port:      parseInt(port) || 161,
      timeouts:  [5000, 5000],
    });
  } catch (err) {
    return res.json({ status: 'down', error: 'Invalid SNMP config: ' + err.message });
  }

  const oidObjects = oidsToFetch.map(o => toOidObj(o));

  session.getAll({ oids: oidObjects }, (err, varbinds) => {
    try { session.close(); } catch (_) {}

    if (err) {
      const msg = err.message || String(err);
      return res.json({ status: 'down', error: friendlyErr(msg) });
    }

    if (!varbinds || varbinds.length === 0)
      return res.json({ status: 'down', error: 'No response from SNMP agent' });

    const allErrors = varbinds.every(v =>
      v.type === 'NoSuchObject' || v.type === 'NoSuchInstance' || v.type === 'EndOfMibView'
    );
    if (allErrors)
      return res.json({ status: 'down', error: 'All OIDs returned NoSuchObject — wrong community string, or SNMP ACL is blocking this server\'s IP' });

    let uptime;
    try {
      const uptimeBind = varbinds.find(v =>
        v.oid.join('.') === OID_UPTIME.replace(/^\./, '') ||
        (customOid && v.oid.join('.') === customOid.replace(/^\./, ''))
      );
      if (uptimeBind && uptimeBind.type === 'TimeTicks' && uptimeBind.value != null) {
        uptime = formatUptime(uptimeBind.value);
      } else if (uptimeBind && uptimeBind.value != null) {
        uptime = String(uptimeBind.value);
      }
    } catch (_) {}

    let sysDescr;
    try {
      const descrBind = varbinds.find(v => v.oid.join('.') === OID_SYSDESCR.replace(/^\./, ''));
      if (descrBind && descrBind.value)
        sysDescr = str(descrBind.value)?.slice(0, 80);
    } catch (_) {}

    return res.json({ status: 'up', uptime: uptime || undefined, sysDescr: sysDescr || undefined });
  });
});

// ── POST /probe/snmp/detail  (full system + perf + interfaces) ────────────────
router.post('/snmp/detail', (req, res) => {
  const { host, community, port } = req.body;

  if (!host || typeof host !== 'string' || host.trim() === '')
    return res.status(400).json({ status: 'error', error: 'host is required' });
  if (!community || typeof community !== 'string' || community.trim() === '')
    return res.status(400).json({ status: 'error', error: 'community is required' });

  let session;
  try {
    session = new snmp.Session({
      host:      host.trim(),
      community: community.trim(),
      port:      parseInt(port) || 161,
      timeouts:  [8000, 4000],
    });
  } catch (err) {
    return res.json({ status: 'down', error: 'Invalid SNMP config: ' + err.message });
  }

  // Phase 1 — system + performance OIDs
  const sysOids = [
    OID_SYSDESCR, OID_UPTIME, OID_SYSCONTACT, OID_SYSNAME, OID_SYSLOC,
    OID_CPU_HR,
    OID_RAM_ALLOC, OID_RAM_SIZE, OID_RAM_USED,
    OID_HDD_ALLOC, OID_HDD_SIZE, OID_HDD_USED,
    OID_MT_BOARD, OID_MT_VERSION,
    OID_MT_CPU, OID_MT_CPU2,
    OID_MT_VOLT, OID_MT_TEMP, OID_MT_TEMP2,
    OID_MT_MEMFREE, OID_MT_MEMTOT,
    OID_MT_HFREE,  OID_MT_HTOT,
  ].map(toOidObj);

  // Phase 2 — ifTable for interfaces 1–IF_MAX_IDX
  const indices   = Array.from({ length: IF_MAX_IDX }, (_, i) => i + 1);
  const ifOids    = indices.flatMap(i => [
    `${IF_DESCR}.${i}`,
    `${IF_SPEED}.${i}`,
    `${IF_ADMIN}.${i}`,
    `${IF_OPER}.${i}`,
    `${IF_IN_OCT}.${i}`,
    `${IF_OUT_OCT}.${i}`,
    `${IF_IN_ERR}.${i}`,
    `${IF_OUT_ERR}.${i}`,
  ].map(toOidObj));

  // Run phases sequentially — some agents can't handle parallel UDP bursts
  session.getAll({ oids: sysOids }, (err1, sysBinds) => {
    if (err1) {
      try { session.close(); } catch (_) {}
      return res.json({ status: 'down', error: friendlyErr(err1.message || String(err1)) });
    }

    const safeSysBinds = sysBinds || [];

    session.getAll({ oids: ifOids }, (err2, ifBinds) => {
      try { session.close(); } catch (_) {}
      const safeIfBinds = err2 ? [] : (ifBinds || []);

      // ── Parse system ────────────────────────────────────────────────────────
      const uptimeTicks = num(getVal(safeSysBinds, OID_UPTIME));
      const system = {
        uptime:        formatUptime(uptimeTicks),
        uptimeSeconds: uptimeTicks != null ? Math.floor(uptimeTicks / 100) : null,
        sysDescr:      str(getVal(safeSysBinds, OID_SYSDESCR)),
        sysName:       str(getVal(safeSysBinds, OID_SYSNAME)),
        sysLocation:   str(getVal(safeSysBinds, OID_SYSLOC)),
        sysContact:    str(getVal(safeSysBinds, OID_SYSCONTACT)),
      };

      // ✅ Diagnostic: if ALL system fields are null, the community string is wrong
      // or the router's SNMP ACL is blocking this server's IP.
      const allSystemNull = Object.values(system).every(v => v == null);
      if (allSystemNull) {
        return res.json({
          status: 'down',
          error: 'SNMP agent responded but all OIDs returned null — verify the community string is correct and that SNMP access is allowed from this server\'s IP in the router\'s IP Services / SNMP settings.',
          interfaces: [],
        });
      }

      // ── MikroTik identity ───────────────────────────────────────────────────
      const mtBoard   = str(getVal(safeSysBinds, OID_MT_BOARD));
      const mtVersion = str(getVal(safeSysBinds, OID_MT_VERSION));
      const mikrotik  = (mtBoard || mtVersion) ? { board: mtBoard, firmwareVersion: mtVersion } : null;

      // ── Performance ─────────────────────────────────────────────────────────
      // CPU — prefer MikroTik-specific, fall back to standard
      const mtCpu1   = num(getVal(safeSysBinds, OID_MT_CPU));
      const mtCpu2   = num(getVal(safeSysBinds, OID_MT_CPU2));
      const stdCpu   = num(getVal(safeSysBinds, OID_CPU_HR));
      const cpuPct   = mtCpu1 ?? mtCpu2 ?? stdCpu;

      // Temperature — try both MT gauge slots
      const temp1    = num(getVal(safeSysBinds, OID_MT_TEMP));
      const temp2    = num(getVal(safeSysBinds, OID_MT_TEMP2));
      const tempC    = temp1 ?? temp2;

      // Voltage
      const voltRaw  = num(getVal(safeSysBinds, OID_MT_VOLT)); // decivolts (240 = 24.0V)

      // RAM — try MikroTik gauge first, fall back to hrStorage
      const mtFree   = num(getVal(safeSysBinds, OID_MT_MEMFREE)); // KiB
      const mtTotal  = num(getVal(safeSysBinds, OID_MT_MEMTOT));  // KiB
      const hrAlloc  = num(getVal(safeSysBinds, OID_RAM_ALLOC));  // bytes per unit
      const hrSize   = num(getVal(safeSysBinds, OID_RAM_SIZE));   // units
      const hrUsed   = num(getVal(safeSysBinds, OID_RAM_USED));   // units

      let ramUsed  = null, ramTotal = null;
      if (mtTotal != null && mtFree != null) {
        ramTotal = mtTotal * 1024;           // KiB → bytes
        ramUsed  = (mtTotal - mtFree) * 1024;
      } else if (hrAlloc != null && hrSize != null && hrUsed != null) {
        ramTotal = hrAlloc * hrSize;
        ramUsed  = hrAlloc * hrUsed;
      }

      // HDD — try MikroTik gauge first, fall back to hrStorage index 131072
      const mtHFree  = num(getVal(safeSysBinds, OID_MT_HFREE));  // KiB
      const mtHTot   = num(getVal(safeSysBinds, OID_MT_HTOT));   // KiB
      const hrAlloc2 = num(getVal(safeSysBinds, OID_HDD_ALLOC));
      const hrSize2  = num(getVal(safeSysBinds, OID_HDD_SIZE));
      const hrUsed2  = num(getVal(safeSysBinds, OID_HDD_USED));

      let hddUsed  = null, hddTotal = null;
      if (mtHTot != null && mtHFree != null) {
        hddTotal = mtHTot * 1024;
        hddUsed  = (mtHTot - mtHFree) * 1024;
      } else if (hrAlloc2 != null && hrSize2 != null && hrUsed2 != null) {
        hddTotal = hrAlloc2 * hrSize2;
        hddUsed  = hrAlloc2 * hrUsed2;
      }

      const performance = {
        cpuPercent:       cpuPct,
        ramUsedBytes:     ramUsed,
        ramTotalBytes:    ramTotal,
        hddUsedBytes:     hddUsed,
        hddTotalBytes:    hddTotal,
        temperatureCelsius: tempC,
        voltageDecivolts: voltRaw,
      };

      // ── Interfaces ──────────────────────────────────────────────────────────
      const interfaces = [];
      for (const i of indices) {
        const descrVal = str(getVal(safeIfBinds, `${IF_DESCR}.${i}`));
        if (!descrVal) continue; // interface doesn't exist at this index

        const operVal  = num(getVal(safeIfBinds, `${IF_OPER}.${i}`));
        if (operVal === null) continue;

        const adminVal = num(getVal(safeIfBinds, `${IF_ADMIN}.${i}`));
        const speedVal = num(getVal(safeIfBinds, `${IF_SPEED}.${i}`));
        const inOct    = num(getVal(safeIfBinds, `${IF_IN_OCT}.${i}`));
        const outOct   = num(getVal(safeIfBinds, `${IF_OUT_OCT}.${i}`));
        const inErr    = num(getVal(safeIfBinds, `${IF_IN_ERR}.${i}`));
        const outErr   = num(getVal(safeIfBinds, `${IF_OUT_ERR}.${i}`));

        interfaces.push({
          index:       i,
          name:        descrVal,
          operStatus:  operVal === 1 ? 'up' : operVal === 2 ? 'down' : 'unknown',
          adminStatus: adminVal === 1 ? 'up' : adminVal === 2 ? 'down' : 'unknown',
          speedBps:    speedVal,
          inOctets:    inOct,
          outOctets:   outOct,
          inErrors:    inErr,
          outErrors:   outErr,
        });
      }

      return res.json({
        status: 'up',
        system,
        performance,
        mikrotik,
        interfaces,
        checkedAt: new Date().toISOString(),
      });
    });
  });
});

export default router;
