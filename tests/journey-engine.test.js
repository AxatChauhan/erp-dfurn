const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Exact copy of monotonic engine logic from EnquiryDetailModal
const QUOTE_SUB_MAP = {
  Draft: 'Draft',
  'Verification Required': 'To check',
  'Admin Approval Required': 'To approve',
  Approved: 'Approved',
  'Not Approved': 'Not approved',
  Sent: 'Sent',
  'Followup Needed': 'Follow up',
  Converted: 'Won',
  'Not Converted': 'Lost'
};

function buildJourneySteps(enquiry) {
  const stageIdx = { New: 0, Qualified: 1, Quoted: 2, Converted: 3 }[enquiry.stage] ?? 0;
  const dates = (typeof enquiry.stageDates === 'object' && enquiry.stageDates) ? enquiry.stageDates : {};
  const quote = enquiry.quote;
  const jobOrder = enquiry.jobOrder;
  const qs = quote ? (quote.effectiveStatus || quote.status) : null;
  const won = enquiry.stage === 'Converted' || qs === 'Converted';
  const isLost = enquiry.outcome === 'Lost';
  
  const tracks = jobOrder ? [
    ['BOM', jobOrder.bomStatus],
    ['Procurement', jobOrder.procurementStatus],
    ['Production', jobOrder.productionStatus]
  ] : null;
  const allTracksDone = !!tracks && tracks.every(t => t[1] === 'Completed');
  const trackStarted = !!tracks && tracks.some(t => t[1] && t[1] !== 'Pending');

  const left = [
    stageIdx >= 1,                     // Enquiry left once qualified
    !!quote || stageIdx >= 2,          // Qualified left once quote exists
    won,                               // Quote left once won
    !!jobOrder,                        // Order left once job order exists
    allTracksDone                      // Production left once tracks complete
  ];
  const cur = left.indexOf(false);     // -1: every built step is done

  const by = (name) => (name ? 'by ' + name : '');
  const received = enquiry.enteredByName ? 'by ' + enquiry.enteredByName : '';

  const defs = [
    {
      label: 'Enquiry',
      done: 'Received',
      now: 'Needs qualifying',
      when: enquiry.createdAt,
      by: received
    },
    {
      label: 'Qualified',
      done: 'Qualified',
      now: stageIdx >= 1 ? 'Ready to quote' : '',
      when: dates.Qualified,
      by: by(enquiry.qualifiedByName)
    },
    {
      label: 'Quote',
      done: 'Won',
      now: quote ? (QUOTE_SUB_MAP[qs] || qs) : 'Not made yet',
      when: won ? (quote && (quote.decidedAt || quote.createdAt)) : (quote && quote.createdAt),
      verb: won ? 'Won' : 'Created',
      by: won ? '' : by(quote && quote.createdByName)
    },
    {
      label: 'Order',
      done: 'Created',
      now: 'To create',
      when: jobOrder && (jobOrder.createdAt || jobOrder.orderDate),
      by: by(jobOrder && jobOrder.createdByName)
    },
    {
      label: 'Production',
      done: 'Complete',
      tracks,
      now: !jobOrder ? '' : jobOrder.cancelledReason ? 'Cancelled' : jobOrder.holdReason ? 'On hold'
        : (trackStarted ? 'In progress' : 'Not started') + (jobOrder.productionDueDate ? ' · due ' + jobOrder.productionDueDate : '')
    }
  ];

  const steps = defs.map((d, i) => {
    const base = { label: d.label, tracks: d.tracks || null };
    if (cur === -1 || i < cur) {
      const metaParts = [];
      if (d.when) metaParts.push((d.verb ? d.verb + ' ' : '') + d.when);
      if (d.by) metaParts.push(d.by);
      return { ...base, state: 'done', sub: d.done, meta: metaParts.join(' · ') };
    }
    if (i === cur) {
      const metaParts = [];
      if (d.when && (i === 0 || i === 1 || (i === 2 && quote))) {
        metaParts.push((d.verb ? d.verb + ' ' : '') + d.when);
      } else if (i === 1) {
        metaParts.push('Date not recorded');
      }
      if (d.by) metaParts.push(d.by);
      return { ...base, state: 'active', sub: d.now, meta: metaParts.join(' · ') };
    }
    return { label: d.label, state: 'todo', sub: '', meta: '', tracks: null };
  });

  ['QC', 'Dispatch', 'Installation'].forEach(label => steps.push({ label, state: 'todo', sub: '', meta: '', title: 'Not tracked yet' }));

  if (jobOrder && cur === 4) {
    if (jobOrder.cancelledReason) steps[4].state = 'off';
    else if (jobOrder.holdReason) steps[4].state = 'bad';
  }

  if (isLost && cur !== -1) {
    const ev = (enquiry.history || []).slice().reverse().find(h => h.type === 'lost');
    const lostMeta = [
      enquiry.lostAt || '',
      ev?.byName ? 'by ' + ev.byName : ''
    ].filter(Boolean).join(' · ');
    steps[cur] = {
      ...steps[cur],
      state: 'bad',
      sub: 'Lost' + (enquiry.lostReason ? `: ${enquiry.lostReason}` : ''),
      meta: lostMeta
    };
    steps.forEach((s, idx) => {
      if (idx > cur) {
        s.state = 'off';
        s.sub = '';
        s.meta = '';
      }
    });
  }

  return steps;
}

// Address normalization logic from EnquiryDetailModal
const FILLER_ADDR_RE = /^(n\.?\s*\/?\s*a\.?|not applicable|nil|none|-+)$/i;
function formatAddressLines(a) {
  if (!a) return [];
  const v = (k) => { const s = String(a[k] || '').trim(); return FILLER_ADDR_RE.test(s) ? '' : s; };
  const state = v('state').toLowerCase() === v('country').toLowerCase() ? '' : v('state');
  const cityState = [v('city'), state].filter(Boolean).join(', ');
  const place = [cityState, v('pincode')].filter(Boolean).join(' ');
  return [v('addressLine1') || v('street'), v('addressLine2'), place, v('country')].filter(Boolean);
}

describe('8-Step Monotonic Pipeline Engine Tests', () => {
  test('Case 1: Stage "New" without quote has EXACTLY 1 active step and 0 done steps', () => {
    const enquiry = {
      stage: 'New',
      outcome: 'Open',
      createdAt: '2026-10-15T09:00:00Z',
      enteredByName: 'Super Admin',
      quote: null,
      jobOrder: null,
    };
    const steps = buildJourneySteps(enquiry);
    assert.equal(steps.length, 8, 'Pipeline must have exactly 8 steps');

    const activeSteps = steps.filter(s => s.state === 'active');
    assert.equal(activeSteps.length, 1, 'Must have exactly ONE active step');
    assert.equal(steps[0].label, 'Enquiry');
    assert.equal(steps[0].state, 'active');
    assert.equal(steps[0].sub, 'Needs qualifying');

    const doneSteps = steps.filter(s => s.state === 'done');
    assert.equal(doneSteps.length, 0, 'No steps should be marked done yet');

    const todoSteps = steps.slice(1);
    assert.ok(todoSteps.every(s => s.state === 'todo'), 'Steps 1 through 7 must all be plain todo');
  });

  test('Case 2: Stage "Qualified" without quote marks Enquiry done and Qualified active', () => {
    const enquiry = {
      stage: 'Qualified',
      outcome: 'Open',
      createdAt: '2026-10-14T09:00:00Z',
      stageDates: { Qualified: '2026-10-15T10:00:00Z' },
      qualifiedByName: 'Evaluator',
      quote: null,
      jobOrder: null,
    };
    const steps = buildJourneySteps(enquiry);

    assert.equal(steps[0].state, 'done');
    assert.equal(steps[0].sub, 'Received');

    assert.equal(steps[1].state, 'active');
    assert.equal(steps[1].sub, 'Ready to quote');

    const activeSteps = steps.filter(s => s.state === 'active');
    assert.equal(activeSteps.length, 1, 'Only Qualified should be active');

    const todoSteps = steps.slice(2);
    assert.ok(todoSteps.every(s => s.state === 'todo'), 'Steps 2 through 7 must be todo');
  });

  test('Case 3: Stage "Qualified" with draft quotation marks Enquiry & Qualified done, Quote active', () => {
    const enquiry = {
      stage: 'Qualified',
      outcome: 'Open',
      createdAt: '2026-10-14T09:00:00Z',
      stageDates: { Qualified: '2026-10-14T11:00:00Z' },
      quote: {
        number: 'DF_QT_001',
        status: 'Draft',
        effectiveStatus: 'Draft',
        createdAt: '2026-10-15T09:30:00Z',
        createdByName: 'Sales Rep'
      },
      jobOrder: null,
    };
    const steps = buildJourneySteps(enquiry);

    assert.equal(steps[0].state, 'done');
    assert.equal(steps[1].state, 'done');
    assert.equal(steps[2].state, 'active');
    assert.equal(steps[2].sub, 'Draft');

    const activeSteps = steps.filter(s => s.state === 'active');
    assert.equal(activeSteps.length, 1, 'Only Quote should be active');

    const todoSteps = steps.slice(3);
    assert.ok(todoSteps.every(s => s.state === 'todo'), 'Order through Installation must be todo');
  });

  test('Case 4: Stage "Converted" with Won quote and active Job Order', () => {
    const enquiry = {
      stage: 'Converted',
      outcome: 'Open',
      createdAt: '2026-10-10T09:00:00Z',
      stageDates: { Qualified: '2026-10-11T09:00:00Z' },
      quote: {
        number: 'DF_QT_001',
        status: 'Converted',
        effectiveStatus: 'Converted',
        decidedAt: '2026-10-12T09:00:00Z',
      },
      jobOrder: {
        jobNumber: 'JO-001',
        createdAt: '2026-10-13T09:00:00Z',
        createdByName: 'Manager',
        bomStatus: 'Completed',
        procurementStatus: 'In Progress',
        productionStatus: 'Pending',
      }
    };
    const steps = buildJourneySteps(enquiry);

    assert.equal(steps[0].state, 'done', 'Enquiry done');
    assert.equal(steps[1].state, 'done', 'Qualified done');
    assert.equal(steps[2].state, 'done', 'Quote done (Won)');
    assert.equal(steps[2].sub, 'Won');
    assert.equal(steps[3].state, 'done', 'Order done (Created)');
    assert.equal(steps[4].state, 'active', 'Production active');
    assert.equal(steps[4].sub, 'In progress');

    const activeSteps = steps.filter(s => s.state === 'active');
    assert.equal(activeSteps.length, 1, 'Only Production step is active');
  });

  test('Case 5: Lost enquiry at "New" turns step 0 to "bad" and strikes out steps 1-7', () => {
    const enquiry = {
      stage: 'New',
      outcome: 'Lost',
      lostReason: 'Budget Cancelled',
      lostAt: '2026-10-15T09:06:10Z',
      history: [
        { type: 'lost', at: '2026-10-15T09:06:10Z', byName: 'User', atStage: 'New' }
      ],
      quote: null,
      jobOrder: null
    };
    const steps = buildJourneySteps(enquiry);

    assert.equal(steps[0].state, 'bad', 'Step 0 must be bad (red dot)');
    assert.equal(steps[0].sub, 'Lost: Budget Cancelled');

    for (let i = 1; i < 8; i++) {
      assert.equal(steps[i].state, 'off', `Step ${i} must be off (struck through)`);
    }
  });

  test('Case 6: Lost enquiry at "Qualified" keeps step 0 done, step 1 bad, steps 2-7 off', () => {
    const enquiry = {
      stage: 'Qualified',
      outcome: 'Lost',
      lostReason: 'Competitor Chosen',
      lostAt: '2026-10-15T09:06:10Z',
      stageDates: { Qualified: '2026-10-14T10:00:00Z' },
      history: [
        { type: 'lost', at: '2026-10-15T09:06:10Z', byName: 'User', atStage: 'Qualified' }
      ],
      quote: null,
      jobOrder: null
    };
    const steps = buildJourneySteps(enquiry);

    assert.equal(steps[0].state, 'done', 'Step 0 is done');
    assert.equal(steps[1].state, 'bad', 'Step 1 is bad (red dot)');
    assert.equal(steps[1].sub, 'Lost: Competitor Chosen');

    for (let i = 2; i < 8; i++) {
      assert.equal(steps[i].state, 'off', `Step ${i} must be off (struck through)`);
    }
  });
});

describe('Client Address Normalizer Tests', () => {
  test('Formats complete billing address correctly', () => {
    const addr = {
      addressLine1: 'Flat 402, Lotus Tower',
      addressLine2: 'Linking Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      country: 'India',
      isBilling: true
    };
    const lines = formatAddressLines(addr);
    assert.deepEqual(lines, [
      'Flat 402, Lotus Tower',
      'Linking Road',
      'Mumbai, Maharashtra 400050',
      'India'
    ]);
  });

  test('Handles street alias and filters filler strings', () => {
    const addr = {
      street: '12 Industrial Area',
      addressLine2: 'N/A',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
      country: 'India'
    };
    const lines = formatAddressLines(addr);
    assert.deepEqual(lines, [
      '12 Industrial Area',
      'Ahmedabad, Gujarat 380015',
      'India'
    ]);
  });

  test('Returns empty array for null/empty addresses', () => {
    assert.deepEqual(formatAddressLines(null), []);
    assert.deepEqual(formatAddressLines({}), []);
    assert.deepEqual(formatAddressLines({ addressLine1: 'N/A', city: 'nil' }), []);
  });
});
