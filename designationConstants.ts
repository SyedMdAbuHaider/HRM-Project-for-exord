// ─────────────────────────────────────────────────────────────────────────────
// EXORD ONLINE — Designation pay-scale tables
// ─────────────────────────────────────────────────────────────────────────────

export type DesignationTrack = 'EXECUTIVE' | 'TECHNICIAN';

export interface DesignationTier {
  title: string;
  minSalary: number;
  maxSalary: number;
}

export const EXECUTIVE_DESIGNATIONS: DesignationTier[] = [
  { title: 'Assistant Executive Officer',    minSalary: 10000,  maxSalary: 11999  },
  { title: 'Executive Officer',              minSalary: 12000,  maxSalary: 14999  },
  { title: 'Senior Executive Officer',       minSalary: 15000,  maxSalary: 18999  },
  { title: 'Deputy Assistant Manager',       minSalary: 19000,  maxSalary: 23999  },
  { title: 'Assistant Manager',              minSalary: 24000,  maxSalary: 29999  },
  { title: 'Senior Assistant Manager',       minSalary: 30000,  maxSalary: 37999  },
  { title: 'Deputy Manager',                 minSalary: 38000,  maxSalary: 47999  },
  { title: 'Manager',                        minSalary: 48000,  maxSalary: 59999  },
  { title: 'Senior Manager',                 minSalary: 60000,  maxSalary: 74999  },
  { title: 'Assistant General Manager (AGM)',minSalary: 75000,  maxSalary: 94999  },
  { title: 'Deputy General Manager (DGM)',   minSalary: 95000,  maxSalary: 119999 },
  { title: 'General Manager (GM)',           minSalary: 120000, maxSalary: 149999 },
];

export const TECHNICIAN_DESIGNATIONS: DesignationTier[] = [
  { title: 'Associate Technician',           minSalary: 7000,  maxSalary: 8999   },
  { title: 'Junior Technician',              minSalary: 9000,  maxSalary: 10999  },
  { title: 'Assistant Technician',           minSalary: 11000, maxSalary: 13999  },
  { title: 'Technician',                     minSalary: 14000, maxSalary: 17999  },
  { title: 'Senior Technician',              minSalary: 18000, maxSalary: 21999  },
  { title: 'Assistant Chief Technician',     minSalary: 22000, maxSalary: 26999  },
  { title: 'Chief Technician',               minSalary: 27000, maxSalary: 31999  },
  { title: 'Transmission Coordinator',       minSalary: 32000, maxSalary: 37999  },
  { title: 'Senior Transmission Coordinator',minSalary: 38000, maxSalary: 44999  },
  { title: 'Assistant Transmission Manager', minSalary: 45000, maxSalary: 53999  },
  { title: 'Transmission Manager',           minSalary: 54000, maxSalary: 63999  },
  { title: 'Senior Transmission Manager',    minSalary: 64000, maxSalary: 74999  },
];

/**
 * Returns the designation title for a given track and salary.
 * Returns null if salary is outside all defined tiers.
 */
export function resolveDesignationFromSalary(
  track: DesignationTrack,
  salary: number
): string | null {
  const tiers = track === 'EXECUTIVE' ? EXECUTIVE_DESIGNATIONS : TECHNICIAN_DESIGNATIONS;
  const tier = tiers.find(t => salary >= t.minSalary && salary <= t.maxSalary);
  return tier ? tier.title : null;
}

/**
 * Returns the tier index (0-based) for the given track and salary.
 * Returns -1 if not found.
 */
export function getTierIndex(track: DesignationTrack, salary: number): number {
  const tiers = track === 'EXECUTIVE' ? EXECUTIVE_DESIGNATIONS : TECHNICIAN_DESIGNATIONS;
  return tiers.findIndex(t => salary >= t.minSalary && salary <= t.maxSalary);
}
