// Utilities for Enquiry Funnel Logic, Aging Analysis & Code Formatting

export const ENQUIRY_STAGES = ['New', 'Qualified', 'Quoted', 'Converted'] as const;
export type EnquiryStage = typeof ENQUIRY_STAGES[number];

export const LOST_REASONS = [
  'Price Too High',
  'Competitor Chosen',
  'Project Postponed / Delayed',
  'Budget Cancelled',
  'Client Unresponsive / Lost Contact',
  'Product Specifications Mismatch',
  'Other'
] as const;

export const TIMELINES = [
  'Urgent (< 2 weeks)',
  'Within 1 Month',
  '1 - 3 Months',
  'Flexible / Planning Phase'
];

export const PROPERTY_TYPES = [
  'Residential Apartment',
  'Villa / Bungalow',
  'Commercial Office',
  'Retail Store / Showroom',
  'Hospitality / Restaurant',
  'Other'
];

// Fallback default salespersons mapped to HRM employee directory
export const COMMON_SALESPERSONS = [
  { id: 'sp-1', employeeCode: 'HR-0001', name: 'Rajesh Sharma', role: 'Senior Sales Lead' },
  { id: 'sp-2', employeeCode: 'HR-0002', name: 'Pooja Verma', role: 'Commercial Sales Specialist' },
  { id: 'sp-3', employeeCode: 'HR-0003', name: 'Vikram Patel', role: 'Architect Liaison' },
  { id: 'sp-4', employeeCode: 'HR-0004', name: 'Amit Desai', role: 'Projects Coordinator' },
];

/**
 * Sequential Code Formatter: 1 -> DF_ENQ_000001
 */
export function formatEnquiryCode(seqNumber: number): string {
  return `DF_ENQ_${String(seqNumber).padStart(6, '0')}`;
}

/**
 * Evaluates whether a stage change is an advance (high-water mark).
 * Stage never demotes backwards.
 */
export function canAdvanceStage(currentStage: string, targetStage: string): boolean {
  const currentIdx = ENQUIRY_STAGES.indexOf(currentStage as EnquiryStage);
  const targetIdx = ENQUIRY_STAGES.indexOf(targetStage as EnquiryStage);
  if (currentIdx === -1 || targetIdx === -1) return true;
  return targetIdx >= currentIdx;
}

/**
 * Calculates lead aging and staleness status:
 * 🟢 ACTIVE: Activity in last 48 hours or future follow-up scheduled
 * 🟡 STALE: 2 - 5 days with no interaction
 * 🔴 OVERDUE: Missed follow-up or > 5 days with zero contact
 */
export function getLeadAging(enquiry: {
  createdAt?: string | Date;
  updatedAt?: string | Date;
  nextFollowUp?: string | Date | null;
}): {
  status: 'ACTIVE' | 'STALE' | 'OVERDUE';
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  const now = new Date();

  // 1. Check if next follow up is overdue
  if (enquiry.nextFollowUp) {
    const followUpDate = new Date(enquiry.nextFollowUp);
    if (followUpDate < now) {
      return {
        status: 'OVERDUE',
        label: 'Follow-up Overdue',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        dotClass: 'bg-red-500'
      };
    }
  }

  // 2. Check elapsed time since last touch (updatedAt or createdAt)
  const lastActive = enquiry.updatedAt ? new Date(enquiry.updatedAt) : (enquiry.createdAt ? new Date(enquiry.createdAt) : now);
  const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 5) {
    return {
      status: 'OVERDUE',
      label: `${diffDays}d Stagnant`,
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      dotClass: 'bg-red-500'
    };
  }

  if (diffDays >= 2) {
    return {
      status: 'STALE',
      label: `${diffDays}d No Contact`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClass: 'bg-amber-500'
    };
  }

  return {
    status: 'ACTIVE',
    label: diffDays === 0 ? 'Active Today' : `${diffDays}d Active`,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500'
  };
}
