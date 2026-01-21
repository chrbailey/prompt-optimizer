/**
 * SAP Enterprise Examples for Prompt Optimization
 *
 * All examples use a single fictional company "TechGear Industries"
 * (consumer electronics manufacturer) to demonstrate interconnected
 * insights across SAP/ERP consulting scenarios.
 *
 * IMPORTANT: Internal symbols (Ξ.*) are used for context retrieval
 * and optimization but are NEVER exposed in user-facing outputs.
 */

export interface SAPExample {
  id: string;
  category: 'personnel' | 'financial' | 'process' | 'customer' | 'system' | 'strategic';
  title: string;
  description: string;

  /** The naive/generic prompt */
  beforePrompt: string;

  /** The optimized prompt (what we generate) */
  afterPrompt: string;

  /** Expected improvement percentage */
  expectedImprovement: number;

  /** Internal symbol IDs used (NEVER exposed to user) */
  internalSymbols: string[];

  /** What makes this example valuable */
  insight: string;

  /** Tags for retrieval */
  tags: string[];
}

export const sapExamples: SAPExample[] = [
  // ============================================================
  // PERSONNEL INSIGHTS (5 examples)
  // ============================================================

  {
    id: 'personnel-001',
    category: 'personnel',
    title: 'Critical Role Detection - Order Release Bottleneck',
    description: 'Identifies personnel who control critical approval workflows and represent potential bottlenecks in order processing.',

    beforePrompt: 'Who approves orders at TechGear Industries?',

    afterPrompt: `Analyze order release authority at TechGear Industries with focus on:

1. **Bottleneck Identification**: Which individuals have exclusive release authority for orders above $50K? Include their:
   - Average daily release volume
   - Mean time-to-release (in hours)
   - Backup coverage availability
   - Historical vacation/absence impact on order flow

2. **Risk Assessment**: For each identified approver:
   - What percentage of total order value flows through them?
   - What is the revenue impact of 1-day delay in their queue?
   - Are there documented escalation procedures during absence?

3. **Recommended Actions**: Prioritize by revenue impact at risk.

Output as a risk-ranked table with quantified daily exposure.`,

    expectedImprovement: 78,

    internalSymbols: [
      'Ξ.PERSON.ORDER_MGR.OPS_201',
      'Ξ.INSIGHT.POWER.OPS_201',
      'Ξ.PROC.ORDER.RELEASE_AUTH',
      'Ξ.RISK.BOTTLENECK.ORDER_FLOW'
    ],

    insight: 'The optimized prompt transforms a simple directory lookup into a quantified risk assessment that identifies Maria Chen (OPS_201) as controlling 73% of high-value order releases with no trained backup.',

    tags: ['personnel', 'bottleneck', 'order-release', 'risk', 'succession', 'SAP-SD']
  },

  {
    id: 'personnel-002',
    category: 'personnel',
    title: 'Single Point of Failure Identification',
    description: 'Discovers employees with unique system access or knowledge that creates operational risk.',

    beforePrompt: 'What SAP access does the finance team have?',

    afterPrompt: `Map single points of failure in TechGear Industries' SAP authorization landscape:

1. **Unique Access Analysis**: Identify users who are the SOLE holder of critical transaction codes:
   - Revenue recognition (F.27, VF04)
   - Credit management (FD32, FD33)
   - Period closing (MMPV, MR21)
   - Master data maintenance (XD01, XK01)

2. **Knowledge Concentration Risk**: For each unique-access holder:
   - Tenure and retirement eligibility
   - Documented procedures (Y/N and last update date)
   - Cross-trained backup (name or "NONE")
   - Last vacation >5 days and operational impact

3. **Severity Scoring**: Rank by (Revenue Impact) x (Absence Probability) x (Recovery Time)

Format as heat map with RED/YELLOW/GREEN risk indicators and specific mitigation recommendations.`,

    expectedImprovement: 82,

    internalSymbols: [
      'Ξ.PERSON.FIN_CTRL.FIN_087',
      'Ξ.AUTH.UNIQUE.F27_SOLE',
      'Ξ.RISK.SPOF.FINANCE',
      'Ξ.INSIGHT.TENURE.FIN_087'
    ],

    insight: 'Reveals that Robert Kim (FIN_087, 28 years tenure) is the only user with F.27 authorization and eligible for retirement in 14 months with zero documented procedures.',

    tags: ['personnel', 'SPOF', 'authorization', 'risk', 'knowledge-transfer', 'SAP-FI']
  },

  {
    id: 'personnel-003',
    category: 'personnel',
    title: 'Performance Gap Analysis',
    description: 'Identifies productivity variations across employees performing similar roles to inform training.',

    beforePrompt: 'How productive are our order entry clerks?',

    afterPrompt: `Conduct performance gap analysis for TechGear Industries order entry team:

1. **Baseline Metrics** (last 6 months, per employee):
   - Orders processed per hour
   - Error rate (returns, corrections, credit memos)
   - Average order value handled
   - Customer complaint association rate

2. **Gap Identification**:
   - Rank employees from highest to lowest productivity
   - Calculate gap between top quartile and bottom quartile
   - Identify specific error patterns by employee (wrong pricing, incorrect ship-to, missing PO)

3. **Root Cause Correlation**:
   - Training completion dates vs. error rates
   - System used (SAP GUI vs. Fiori) vs. speed
   - Tenure vs. accuracy
   - Shift timing vs. productivity

4. **Actionable Insights**: Specific training modules recommended per employee based on their unique error patterns.

Output as comparative dashboard with anonymized employee IDs and specific intervention recommendations.`,

    expectedImprovement: 71,

    internalSymbols: [
      'Ξ.PERSON.OE_CLERK.OPS_301',
      'Ξ.PERSON.OE_CLERK.OPS_302',
      'Ξ.PERSON.OE_CLERK.OPS_303',
      'Ξ.METRIC.PRODUCTIVITY.OE_TEAM',
      'Ξ.INSIGHT.GAP.OPS_303'
    ],

    insight: 'Analysis reveals Employee OPS_303 has 3.2x error rate on pricing specifically for EMEA region orders - traced to unfamiliarity with currency conversion workflows.',

    tags: ['personnel', 'productivity', 'training', 'performance', 'order-entry', 'SAP-SD']
  },

  {
    id: 'personnel-004',
    category: 'personnel',
    title: 'Succession Planning Needs',
    description: 'Proactively identifies roles requiring succession planning based on tenure, criticality, and knowledge concentration.',

    beforePrompt: 'Who might be retiring soon?',

    afterPrompt: `Generate succession planning priority matrix for TechGear Industries:

1. **Critical Role Inventory**: For roles touching >$10M annual transaction value:
   - Current incumbent name and employee ID
   - Age and retirement eligibility date
   - Years in current role
   - Unique authorizations held (not shared with others)
   - Documented SOPs (count and last review date)

2. **Successor Readiness Assessment**:
   - Identified successor (Y/N and name if Y)
   - Successor's current proficiency (1-5 scale)
   - Training gap estimate (months to full competency)
   - Cross-training started (Y/N and date)

3. **Priority Scoring**: (Retirement_Proximity x Role_Criticality x Knowledge_Concentration) / Successor_Readiness

4. **90-Day Action Plan**: Top 5 priorities with specific knowledge transfer milestones.

Format as executive summary table plus detailed profiles for top 5 risk roles.`,

    expectedImprovement: 85,

    internalSymbols: [
      'Ξ.PERSON.FIN_CTRL.FIN_087',
      'Ξ.PERSON.PLANT_MGR.MFG_012',
      'Ξ.PERSON.IT_ADMIN.IT_045',
      'Ξ.INSIGHT.SUCCESSION.CRITICAL',
      'Ξ.RISK.KNOWLEDGE_LOSS.FIN'
    ],

    insight: 'Surfaces that 3 of the 5 most critical SAP-touching roles have incumbents within 24 months of retirement eligibility with no identified successors.',

    tags: ['personnel', 'succession', 'retirement', 'knowledge-transfer', 'risk', 'strategic']
  },

  {
    id: 'personnel-005',
    category: 'personnel',
    title: 'Cross-Training Recommendations',
    description: 'Identifies optimal cross-training pairs based on skill gaps, schedule availability, and business continuity needs.',

    beforePrompt: 'We need to cross-train our team.',

    afterPrompt: `Design cross-training matrix for TechGear Industries operations team:

1. **Skill Inventory Mapping**:
   | Employee | Primary Skills | Secondary Skills | Critical Gaps |
   - Map against 15 critical SAP transaction categories
   - Rate each: Expert (3), Proficient (2), Basic (1), None (0)

2. **Coverage Gap Analysis**:
   - Which T-codes have <2 proficient users?
   - Which processes stop if specific person is absent?
   - What is the current "bus factor" for each critical process?

3. **Optimal Pairing Algorithm**:
   - Match employees with complementary gaps
   - Consider: shift overlap, department proximity, learning style
   - Prioritize by business impact of coverage gap

4. **Training Schedule**:
   - Week-by-week cross-training calendar
   - Estimated hours per skill transfer
   - Certification/validation checkpoints

5. **Success Metrics**:
   - Target state: minimum 2 proficient users per critical process
   - Timeline to achieve 100% critical coverage

Output as Gantt chart with paired names and specific skill transfer objectives.`,

    expectedImprovement: 74,

    internalSymbols: [
      'Ξ.PERSON.TEAM.OPS_UNIT_A',
      'Ξ.SKILL.MATRIX.OPS_COVERAGE',
      'Ξ.INSIGHT.PAIR.OPTIMAL',
      'Ξ.PROC.CRITICAL.COVERAGE_GAP'
    ],

    insight: 'Identifies that pairing Sarah (OPS_205) with Marcus (OPS_208) covers 7 critical transaction codes in one training relationship, while the obvious pairing would only cover 3.',

    tags: ['personnel', 'cross-training', 'skills', 'coverage', 'business-continuity', 'SAP-basis']
  },

  // ============================================================
  // FINANCIAL CONTROLS (4 examples)
  // ============================================================

  {
    id: 'financial-001',
    category: 'financial',
    title: 'Credit Risk Customer Identification',
    description: 'Proactively identifies customers exhibiting early warning signs of credit deterioration.',

    beforePrompt: 'Which customers have overdue invoices?',

    afterPrompt: `Perform credit risk early warning analysis for TechGear Industries customer portfolio:

1. **Deterioration Indicators** (flag if ANY present):
   - Payment pattern shift: Average DSO increased >15% vs. prior 6 months
   - Partial payments: >2 instances of paying less than invoiced in 90 days
   - Promise-to-pay breaks: Failed to pay by committed date >1 time
   - Contact avoidance: Unreturned AR calls in last 30 days
   - External signals: Credit score drop, news of layoffs, key customer loss

2. **Exposure Quantification** per flagged customer:
   - Current AR balance
   - Open order value not yet shipped
   - Credit limit vs. utilization %
   - Unsecured exposure (AR - deposits - guarantees)

3. **Trend Analysis**:
   - Graph: DSO trend by month (12 months)
   - Graph: Payment amount vs. invoice amount (shows partial payment pattern)
   - Aging bucket migration (are old buckets growing?)

4. **Recommended Actions** by customer:
   - Hold new orders (Y/N)
   - Require prepayment (amount)
   - Reduce credit limit (to what)
   - Collection escalation (to whom)

Output as risk-tiered customer list with specific action items and dollar exposure.`,

    expectedImprovement: 81,

    internalSymbols: [
      'Ξ.CUSTOMER.DIST_WEST.CUS10042',
      'Ξ.CUSTOMER.RETAIL_CHAIN.CUS10089',
      'Ξ.CONTROL.CREDIT.FD32',
      'Ξ.INSIGHT.RISK.CUS10042',
      'Ξ.METRIC.DSO.DETERIORATE'
    ],

    insight: 'Reveals that Western Distribution (CUS10042) DSO increased from 34 to 52 days over 4 months with 3 partial payments - early warning triggered 60 days before they would have hit credit hold.',

    tags: ['financial', 'credit-risk', 'AR', 'early-warning', 'customers', 'SAP-FI-AR']
  },

  {
    id: 'financial-002',
    category: 'financial',
    title: 'SOX Compliance Gap Detection',
    description: 'Identifies segregation of duties violations and control gaps that could impact SOX compliance.',

    beforePrompt: 'Are we SOX compliant?',

    afterPrompt: `Conduct SOX control gap assessment for TechGear Industries SAP environment:

1. **Segregation of Duties Conflicts** - Flag users with both sides of:
   - Create vendor + Release payment (XK01 + F110)
   - Create customer + Apply cash (XD01 + F-28)
   - Modify pricing + Release order (VK11 + VA02)
   - Create PO + Goods receipt (ME21N + MIGO)
   - Journal entry + Period close (FB01 + MMPV)

2. **Conflict Severity Assessment** per violation:
   - Fraud risk (High/Medium/Low)
   - Transaction volume in last 12 months
   - Dollar value of transactions
   - Mitigating controls in place (detective/compensating)

3. **Super User Analysis**:
   - Users with SAP_ALL or equivalent
   - Users with >50 critical T-codes
   - Last review date of privileged access
   - Business justification documented (Y/N)

4. **Control Evidence Gaps**:
   - Controls claimed in process narratives but no system evidence
   - Review/approval logs missing or incomplete
   - Automated controls disabled or bypassed

5. **Remediation Roadmap**:
   - Priority 1: Must fix before audit (30 days)
   - Priority 2: Fix within quarter
   - Priority 3: Address in role redesign project

Output as auditor-ready report with specific user IDs, T-code combinations, and remediation owners.`,

    expectedImprovement: 88,

    internalSymbols: [
      'Ξ.CONTROL.SOX.A6',
      'Ξ.CONTROL.SOX.B2',
      'Ξ.AUTH.CONFLICT.XK01_F110',
      'Ξ.PERSON.IT_ADMIN.IT_045',
      'Ξ.INSIGHT.SOX_GAP.CRITICAL'
    ],

    insight: 'Discovers that IT_045 has create vendor + release payment authority with $2.3M processed in 12 months - undetected because the role was granted "temporarily" 3 years ago.',

    tags: ['financial', 'SOX', 'compliance', 'SoD', 'audit', 'controls', 'SAP-GRC']
  },

  {
    id: 'financial-003',
    category: 'financial',
    title: 'Approval Workflow Optimization',
    description: 'Analyzes approval workflows to reduce delays while maintaining appropriate controls.',

    beforePrompt: 'Our approvals take too long.',

    afterPrompt: `Optimize approval workflow efficiency for TechGear Industries while maintaining control integrity:

1. **Current State Metrics** by approval type:
   | Approval Type | Avg Time | Median | 90th %ile | Bottleneck Step |
   - Purchase requisitions
   - Sales orders (by value tier)
   - Credit limit changes
   - Price deviations
   - Travel expenses

2. **Delay Root Cause Analysis**:
   - Approver queue depth (items pending per approver)
   - Time in queue vs. decision time (waiting vs. working)
   - Mobile approval adoption rate
   - Delegation usage rate during absence
   - Escalation trigger frequency and appropriateness

3. **Threshold Optimization Study**:
   - Current thresholds vs. actual risk distribution
   - % of approvals that are "rubber stamp" (approved within 2 min)
   - Historical rejection rate by threshold tier
   - Recommendation: which thresholds could safely increase?

4. **Parallel vs. Sequential Analysis**:
   - Approvals currently sequential that could be parallel
   - Expected time savings from parallelization

5. **Implementation Recommendations**:
   - Quick wins (config changes, threshold adjustments)
   - Medium-term (workflow redesign)
   - Long-term (intelligent automation candidates)

Output as before/after workflow diagrams with quantified time and cost savings.`,

    expectedImprovement: 76,

    internalSymbols: [
      'Ξ.PROC.APPROVAL.PR_RELEASE',
      'Ξ.PROC.APPROVAL.SO_CREDIT',
      'Ξ.METRIC.APPROVAL_TIME.BASELINE',
      'Ξ.INSIGHT.THRESHOLD.OPTIMIZE',
      'Ξ.PERSON.APPROVER.BOTTLENECK'
    ],

    insight: 'Analysis shows raising PR approval threshold from $5K to $15K would eliminate 62% of approvals (all historically approved within 90 seconds) while catching the same actual risk events.',

    tags: ['financial', 'approval', 'workflow', 'optimization', 'efficiency', 'SAP-workflow']
  },

  {
    id: 'financial-004',
    category: 'financial',
    title: 'Overdue Account Escalation',
    description: 'Creates intelligent escalation paths for overdue accounts based on customer value and risk.',

    beforePrompt: 'Who should call overdue customers?',

    afterPrompt: `Design intelligent AR escalation strategy for TechGear Industries:

1. **Customer Segmentation for Collection Approach**:

   | Segment | Criteria | Escalation Path | Tone |
   | Strategic | Top 20% revenue, long tenure | VP Sales involvement | Relationship-first |
   | Growth | <2 years, increasing volume | Sales rep + AR collab | Supportive |
   | Standard | Middle tier, stable | AR team direct | Professional |
   | High-Risk | Payment history issues | AR Manager + Legal prep | Firm |
   | Distressed | Multiple broken promises | CFO/Legal | Documentation focus |

2. **Escalation Timing Matrix**:
   - Days overdue triggers by segment
   - Dollar threshold triggers regardless of days
   - Call/email sequence by tier
   - When to involve sales vs. go direct

3. **Collector Assignment Optimization**:
   - Match collector experience to customer difficulty
   - Consider existing relationships
   - Balance workload by expected collection effort
   - Language/timezone considerations

4. **Communication Templates**: By segment and escalation stage

5. **Success Metrics**:
   - Target collection rate by segment
   - Days to resolve by tier
   - Customer retention post-collection

Output as decision tree with specific dollar amounts and contact names for current overdue accounts.`,

    expectedImprovement: 69,

    internalSymbols: [
      'Ξ.CUSTOMER.STRATEGIC.CUS10014',
      'Ξ.CUSTOMER.HIGHRISK.CUS10089',
      'Ξ.PROC.AR.ESCALATION',
      'Ξ.PERSON.AR_MGR.FIN_092',
      'Ξ.INSIGHT.COLLECT.SEGMENT'
    ],

    insight: 'Reveals that one-size-fits-all collection calls were damaging relationship with strategic customer CUS10014 (overdue due to their AP system issue, not inability to pay) while being too gentle with CUS10089 (serial slow-payer).',

    tags: ['financial', 'AR', 'collections', 'escalation', 'customer-relationship', 'SAP-FI-AR']
  },

  // ============================================================
  // PROCESS OPTIMIZATION (5 examples)
  // ============================================================

  {
    id: 'process-001',
    category: 'process',
    title: 'Order-to-Cash Cycle Improvement',
    description: 'End-to-end analysis of order-to-cash process to identify and eliminate delays.',

    beforePrompt: 'How can we speed up order processing?',

    afterPrompt: `Conduct order-to-cash cycle time analysis for TechGear Industries:

1. **Process Step Breakdown** (measure each segment):

   | Step | Avg Time | Variance | Bottleneck Frequency |
   | Order entry | ? hrs | | |
   | Credit check | ? hrs | | |
   | Availability check | ? hrs | | |
   | Pricing/approval | ? hrs | | |
   | Pick/pack | ? hrs | | |
   | Ship | ? hrs | | |
   | Invoice | ? hrs | | |
   | Cash receipt | ? days | | |

2. **Variance Analysis**:
   - Why do some orders take 10x longer than median?
   - Top 5 delay reasons with frequency
   - Customer-specific delays (special handling, etc.)
   - Product-specific delays (configuration, sourcing)

3. **Benchmark Gaps**:
   - Current O2C: [X] days
   - Industry benchmark: [Y] days
   - Best-in-class: [Z] days
   - Value of each day reduced (working capital impact)

4. **Quick Win Identification**:
   - Automation opportunities (e.g., auto credit release below threshold)
   - Parallel processing opportunities
   - Unnecessary approval eliminations
   - Integration gaps causing manual re-entry

5. **Roadmap**: 30/60/90 day improvement targets with specific initiatives.

Output as value-stream map with current state, pain points, and future state vision.`,

    expectedImprovement: 79,

    internalSymbols: [
      'Ξ.PROC.ORDER.O2C_FULL',
      'Ξ.PROC.ORDER.CREDIT_HOLD',
      'Ξ.METRIC.CYCLE.O2C_DAYS',
      'Ξ.INSIGHT.DELAY.CREDIT_CHECK',
      'Ξ.INSIGHT.DELAY.MANUAL_PRICE'
    ],

    insight: 'Pinpoints that credit check step averages 4.2 hours but has 22-hour variance - caused by credit analyst (OPS_201) being sole approver above $50K with no auto-release for known-good customers.',

    tags: ['process', 'order-to-cash', 'cycle-time', 'optimization', 'working-capital', 'SAP-SD']
  },

  {
    id: 'process-002',
    category: 'process',
    title: 'Change Management Acceleration',
    description: 'Streamlines the SAP change management process to reduce release cycle time.',

    beforePrompt: 'Our SAP changes take too long to deploy.',

    afterPrompt: `Analyze and optimize SAP change management process for TechGear Industries:

1. **Current Pipeline Metrics**:
   - Average time from request to production: [X] days
   - Time in each phase: Dev / QA / UAT / Approval / Transport
   - Requests in queue at each stage (current backlog)
   - Emergency change frequency and root causes

2. **Approval Chain Analysis**:
   - Number of approvals required by change type
   - Average time in approval vs. rework loops
   - Approval rejection rate and common reasons
   - Inactive approvers blocking queue

3. **Testing Efficiency**:
   - Test script coverage by module
   - Automated test percentage
   - Regression test execution time
   - UAT calendar availability bottlenecks

4. **Transport Management**:
   - Failed transport rate and causes
   - Weekend-only restriction impact
   - Dependency mapping accuracy
   - Rollback frequency and effort

5. **Recommended Improvements**:
   - Change categorization (fast-track criteria)
   - Approval delegation rules
   - Test automation investments
   - Release train cadence optimization

Output as RACI matrix update plus quantified impact of each recommendation.`,

    expectedImprovement: 72,

    internalSymbols: [
      'Ξ.PROC.CHANGE.STMS',
      'Ξ.PROC.CHANGE.APPROVAL_CHAIN',
      'Ξ.PERSON.IT_MGR.IT_012',
      'Ξ.METRIC.CHANGE.CYCLE_DAYS',
      'Ξ.INSIGHT.CHANGE.APPROVAL_DELAY'
    ],

    insight: 'Discovers that 34% of changes wait >5 days for a single approver (IT_012) who only reviews on Fridays - simple delegation policy could cut average cycle time by 40%.',

    tags: ['process', 'change-management', 'ITIL', 'deployment', 'SAP-basis', 'agility']
  },

  {
    id: 'process-003',
    category: 'process',
    title: 'Approval Matrix Simplification',
    description: 'Reduces approval complexity while maintaining appropriate financial controls.',

    beforePrompt: 'Our approval matrix is too complicated.',

    afterPrompt: `Simplify approval matrix for TechGear Industries while preserving control effectiveness:

1. **Current State Inventory**:
   - Count of distinct approval rules across all document types
   - Visualization: approval rule complexity map
   - Rules with zero executions in 12 months (dead rules)
   - Conflicting or overlapping rules

2. **Usage Analysis by Rule**:
   | Rule | Document Type | Threshold | Executions/Year | Approval Rate | Avg Time |
   - Identify "rubber stamp" rules (>99% approval, <2 min decision)
   - Identify high-value rules rarely triggered

3. **Consolidation Opportunities**:
   - Rules that could merge (similar threshold, same approvers)
   - Approver consolidation (one person for multiple related rules)
   - Threshold simplification (too many tiers, could reduce)

4. **Risk Assessment of Changes**:
   - For each proposed simplification:
     - Historical fraud/error incidents related to this control
     - Audit findings in this area
     - Compensating controls available

5. **Proposed New Matrix**:
   - Before: [X] rules
   - After: [Y] rules (Z% reduction)
   - Projected time savings: [hours/month]
   - Any new risks introduced and mitigations

Output as side-by-side comparison with red-line changes and audit defense documentation.`,

    expectedImprovement: 70,

    internalSymbols: [
      'Ξ.CONTROL.APPROVAL.MATRIX_V12',
      'Ξ.PROC.APPROVAL.RULE_COUNT',
      'Ξ.INSIGHT.APPROVAL.REDUNDANT',
      'Ξ.INSIGHT.APPROVAL.DEAD_RULES',
      'Ξ.METRIC.APPROVAL.COMPLEXITY'
    ],

    insight: 'Matrix has grown to 147 rules over 8 years of additions without cleanup - analysis shows 34 rules have never triggered and 28 others could safely consolidate, reducing to 85 rules.',

    tags: ['process', 'approval', 'simplification', 'governance', 'efficiency', 'SAP-workflow']
  },

  {
    id: 'process-004',
    category: 'process',
    title: 'Vendor Duplicate Elimination',
    description: 'Identifies and consolidates duplicate vendor master records to improve data quality and negotiating leverage.',

    beforePrompt: 'Do we have duplicate vendors?',

    afterPrompt: `Conduct vendor master data quality analysis for TechGear Industries:

1. **Duplicate Detection** - Flag potential duplicates based on:
   - Fuzzy name matching (Levenshtein distance <3)
   - Same tax ID different vendor number
   - Same bank account different vendor
   - Same address (normalized) different vendor
   - Same contact email different vendor

2. **Impact Quantification** per duplicate cluster:
   | Vendor Group | # Records | Combined Spend | Payment Terms Variance |
   - Lost volume discount opportunity
   - Increased AP processing cost
   - Payment term inconsistency cost

3. **Root Cause Analysis**:
   - Creation patterns (why do duplicates happen?)
   - Division/plant creating without checking
   - Acquisition-related duplicates
   - Name change not updated

4. **Consolidation Recommendations**:
   - Survive record selection criteria
   - Transaction history merge approach
   - Open PO/invoice handling
   - Communication to vendor

5. **Prevention Controls**:
   - Duplicate check enhancement in XK01
   - Approval workflow for new vendors
   - Periodic data quality reports

Output as vendor duplicate report with merge recommendations and estimated savings from consolidation.`,

    expectedImprovement: 75,

    internalSymbols: [
      'Ξ.VENDOR.DUPLICATE.CLUSTER_A',
      'Ξ.VENDOR.MASTER.VEN50123',
      'Ξ.VENDOR.MASTER.VEN50891',
      'Ξ.INSIGHT.VENDOR.DUP_SPEND',
      'Ξ.PROC.VENDOR.CLEANUP'
    ],

    insight: 'Finds 23 duplicate vendor clusters including one where same supplier has 4 records with payment terms ranging from Net-30 to Net-60 - consolidation could standardize to Net-45 with 2% early pay discount.',

    tags: ['process', 'vendor', 'master-data', 'duplicates', 'procurement', 'SAP-MM']
  },

  {
    id: 'process-005',
    category: 'process',
    title: 'Month-End Close Automation',
    description: 'Identifies manual month-end activities that can be automated to reduce close time.',

    beforePrompt: 'Month-end close takes too long.',

    afterPrompt: `Analyze month-end close process for automation opportunities at TechGear Industries:

1. **Current Close Timeline Mapping**:
   | Day | Activity | Owner | Hours | Manual/Auto | Dependencies |
   - Map all activities from Day 1 through final close
   - Identify critical path
   - Calculate total person-hours

2. **Manual Activity Deep Dive**:
   For each manual step:
   - Why manual? (No system support, exception handling, judgment required)
   - Error frequency and rework time
   - Automation feasibility (High/Medium/Low/None)
   - Estimated automation effort (hours to implement)

3. **Quick Automation Wins**:
   - Recurring journal entries that could auto-post
   - Reports that could auto-generate and distribute
   - Reconciliations with rule-based clearing
   - Validations that could run automatically overnight

4. **Dependency Optimization**:
   - Activities currently sequential that could parallel
   - External dependencies causing delays (bank files, etc.)
   - Buffer time that could be reduced with better visibility

5. **Target State**:
   - Close calendar compression plan
   - Resource reallocation from freed capacity
   - Quality improvement metrics

Output as Gantt chart comparison (current vs. target) with automation implementation roadmap.`,

    expectedImprovement: 77,

    internalSymbols: [
      'Ξ.PROC.CLOSE.MONTHLY',
      'Ξ.PROC.CLOSE.ACTIVITY_MAP',
      'Ξ.PERSON.FIN_CTRL.FIN_087',
      'Ξ.INSIGHT.CLOSE.MANUAL_HOURS',
      'Ξ.INSIGHT.CLOSE.AUTOMATION_OPP'
    ],

    insight: 'Close currently takes 8 business days with 127 person-hours of manual work - analysis shows 41 hours could be automated immediately using existing SAP jobs that are configured but not scheduled.',

    tags: ['process', 'month-end', 'close', 'automation', 'efficiency', 'SAP-FI']
  },

  // ============================================================
  // CUSTOMER ANALYSIS (4 examples)
  // ============================================================

  {
    id: 'customer-001',
    category: 'customer',
    title: 'Credit Exposure Assessment',
    description: 'Comprehensive view of credit exposure including pipeline and concentration risk.',

    beforePrompt: 'What is our AR exposure?',

    afterPrompt: `Conduct comprehensive credit exposure analysis for TechGear Industries:

1. **Total Exposure Calculation** per customer:
   | Customer | AR Balance | Open Orders | Credit Limit | Utilization % | Unsecured Exposure |
   - Include shipped-not-invoiced
   - Include orders pending release
   - Subtract deposits, guarantees, letters of credit
   - Calculate true unsecured exposure

2. **Concentration Risk**:
   - Top 10 customers: % of total exposure
   - Single customer exposure vs. policy limit
   - Industry concentration (what if retail sector struggles?)
   - Geographic concentration (country risk)

3. **Trend Analysis** (6 months):
   - Exposure growth rate vs. revenue growth
   - Credit limit utilization trend
   - New customer credit quality vs. established

4. **Stress Test Scenarios**:
   - Impact if top customer defaults
   - Impact if customers in [industry] pay 30 days slower
   - Bad debt reserve adequacy assessment

5. **Action Items**:
   - Credit limits to reduce
   - Customers requiring security
   - Insurance coverage gaps

Output as executive dashboard with risk indicators and specific limit recommendations.`,

    expectedImprovement: 80,

    internalSymbols: [
      'Ξ.CUSTOMER.PORTFOLIO.CREDIT_EXP',
      'Ξ.CUSTOMER.TOP10.CONCENTRATION',
      'Ξ.METRIC.CREDIT.UTILIZATION',
      'Ξ.INSIGHT.CREDIT.CONCENTRATION_RISK',
      'Ξ.RISK.CREDIT.UNSECURED'
    ],

    insight: 'Reveals that top 3 customers represent 47% of unsecured exposure and all three are in same industry vertical - significant concentration risk not visible in standard AR reports.',

    tags: ['customer', 'credit', 'exposure', 'risk', 'concentration', 'SAP-FI-AR']
  },

  {
    id: 'customer-002',
    category: 'customer',
    title: 'Customer Segment Profitability',
    description: 'Analyzes true profitability by customer segment including cost-to-serve.',

    beforePrompt: 'Which customers are most profitable?',

    afterPrompt: `Conduct customer segment profitability analysis for TechGear Industries:

1. **Revenue Attribution** by segment:
   | Segment | Gross Revenue | Returns | Rebates | Net Revenue |
   - Direct / Distributor / Retail / Online / OEM

2. **Cost-to-Serve Analysis** per segment:
   - Order processing cost (complexity, line items, changes)
   - Fulfillment cost (shipping, special handling, expedite frequency)
   - Support cost (calls, claims, returns processing)
   - Credit/collection cost (DSO impact, dispute frequency)
   - Sales cost (commission structure, visit frequency)

3. **True Profitability Calculation**:
   | Segment | Net Revenue | COGS | Cost-to-Serve | Operating Profit | Margin % |
   - Rank segments by margin contribution
   - Identify "profitable revenue" vs. "busy revenue"

4. **Customer Migration Analysis**:
   - Customers who moved between segments
   - Profitability change after migration
   - Ideal segment for borderline customers

5. **Strategic Recommendations**:
   - Segments to grow (high margin, scalable)
   - Segments to rationalize (low margin, high maintenance)
   - Pricing adjustments by segment
   - Service level differentiation

Output as segment profitability waterfall chart with specific customer lists for action.`,

    expectedImprovement: 83,

    internalSymbols: [
      'Ξ.CUSTOMER.SEGMENT.DIRECT',
      'Ξ.CUSTOMER.SEGMENT.DISTRIB',
      'Ξ.CUSTOMER.SEGMENT.RETAIL',
      'Ξ.METRIC.PROFIT.BY_SEGMENT',
      'Ξ.INSIGHT.PROFIT.COST_TO_SERVE'
    ],

    insight: 'Retail segment appears 2nd highest revenue but drops to 5th in profitability when cost-to-serve is included - high return rate and small order sizes destroy margin.',

    tags: ['customer', 'profitability', 'segmentation', 'cost-to-serve', 'margin', 'SAP-CO']
  },

  {
    id: 'customer-003',
    category: 'customer',
    title: 'Collection Priority Ranking',
    description: 'Intelligent prioritization of collection efforts based on multiple factors.',

    beforePrompt: 'Which overdue invoices should we collect first?',

    afterPrompt: `Create intelligent collection priority ranking for TechGear Industries:

1. **Multi-Factor Scoring Model**:
   For each overdue invoice, calculate priority score:

   - Amount weight: Higher dollar = higher priority (scaled 1-10)
   - Age weight: Older = higher priority (exponential after 60 days)
   - Customer risk weight: Historical payment behavior (1-10)
   - Relationship weight: Strategic customer = careful handling (-3 to +3)
   - Dispute indicator: If in dispute, adjust priority (-5)
   - Collectability: Based on customer financial health (1-10)

   Priority Score = (Amount x 0.3) + (Age x 0.25) + (Risk x 0.2) + (Collectability x 0.25) + Relationship adjustment

2. **Collection Queue**:
   | Rank | Customer | Invoice | Amount | Days OD | Score | Recommended Action |
   - Top 20 prioritized collection targets
   - Assigned collector based on customer relationship

3. **Collection Strategy by Tier**:
   - Tier 1 (Score >8): Daily follow-up, manager escalation ready
   - Tier 2 (Score 5-8): Weekly contact, payment plan eligible
   - Tier 3 (Score <5): Monthly reminder, low effort

4. **Workload Balancing**:
   - Distribute by collector capacity
   - Consider collector success rate with customer type
   - Factor in time zones and language

Output as prioritized work queue with click-to-call integration and script notes.`,

    expectedImprovement: 74,

    internalSymbols: [
      'Ξ.CUSTOMER.OVERDUE.QUEUE',
      'Ξ.METRIC.COLLECT.PRIORITY_SCORE',
      'Ξ.INSIGHT.COLLECT.ALGORITHM',
      'Ξ.PERSON.AR_COLLECTOR.FIN_094',
      'Ξ.PROC.AR.COLLECTION_STRATEGY'
    ],

    insight: 'Standard "oldest first" approach was spending 40% of collection effort on invoices with low collectability - new scoring redirects effort to $340K that is actually recoverable.',

    tags: ['customer', 'collections', 'AR', 'priority', 'working-capital', 'SAP-FI-AR']
  },

  {
    id: 'customer-004',
    category: 'customer',
    title: 'Credit Limit Recommendations',
    description: 'Data-driven credit limit recommendations based on customer behavior and risk.',

    beforePrompt: 'Should we increase customer credit limits?',

    afterPrompt: `Generate credit limit recommendations for TechGear Industries customer base:

1. **Credit Limit Health Check** - Current portfolio:
   | Tier | # Customers | Avg Utilization | Avg DSO | Block Frequency |
   - Well under limit (<50%): opportunity to grow or reduce
   - Near limit (50-80%): monitor closely
   - At limit (>80%): evaluate for increase or additional controls
   - Frequently blocked: causing sales friction

2. **Increase Candidates** (score each factor 1-5):
   - Payment history (last 12 months perfect = 5)
   - DSO vs. terms (better than terms = 5)
   - Revenue growth (growing relationship = 5)
   - Financial health (external credit data)
   - Strategic value (key account status)

   Recommend increase if total score >20 AND no recent slow pay

3. **Decrease Candidates**:
   - Payment deterioration trend
   - Utilization dropped significantly (customer shrinking?)
   - External credit warnings
   - Industry distress signals

4. **Specific Recommendations**:
   | Customer | Current Limit | Recommended | Change | Rationale |
   - Dollar-specific recommendations with justification
   - Supporting data for each recommendation

5. **Policy Exceptions**:
   - Customers who need special treatment (relationship > algorithm)
   - Document exception rationale

Output as credit committee-ready report with approve/deny recommendations and supporting analytics.`,

    expectedImprovement: 76,

    internalSymbols: [
      'Ξ.CUSTOMER.CREDIT.LIMIT_REVIEW',
      'Ξ.METRIC.CREDIT.UTILIZATION_TIER',
      'Ξ.INSIGHT.CREDIT.INCREASE_CANDIDATE',
      'Ξ.INSIGHT.CREDIT.DECREASE_CANDIDATE',
      'Ξ.CONTROL.CREDIT.FD32'
    ],

    insight: 'Identifies 12 customers blocked >5 times in 90 days who qualify for limit increases based on perfect payment history - removing friction could unlock $890K in held orders.',

    tags: ['customer', 'credit', 'limit', 'recommendation', 'risk-management', 'SAP-FI-AR']
  },

  // ============================================================
  // SYSTEM/MIGRATION (4 examples)
  // ============================================================

  {
    id: 'system-001',
    category: 'system',
    title: 'ERP Migration Data Quality',
    description: 'Assesses data quality for ERP migration readiness and identifies remediation needs.',

    beforePrompt: 'Is our data ready for the ERP migration?',

    afterPrompt: `Conduct comprehensive data quality assessment for TechGear Industries S/4HANA migration:

1. **Master Data Health** by object type:

   | Object | Total Records | Complete | Incomplete | Duplicates | Obsolete |
   | Customer | | | | | |
   | Vendor | | | | | |
   | Material | | | | | |
   | GL Account | | | | | |
   | Cost Center | | | | | |
   | BOM | | | | | |

2. **Critical Field Analysis**:
   For each master data type, assess required S/4 fields:
   - Field completion rate
   - Field validity (correct format, valid values)
   - Fields requiring transformation
   - Fields with no equivalent (data loss risk)

3. **Transactional Data Assessment**:
   - Open items that must migrate (POs, SOs, invoices)
   - Historical data volume and archiving strategy
   - Data with broken references (orphan records)

4. **Business Rule Validation**:
   - Pricing conditions complexity
   - Output determination rules
   - Partner functions completeness
   - Credit management data

5. **Remediation Roadmap**:
   | Issue Category | Record Count | Effort (hours) | Owner | Timeline |
   - Prioritize by migration-blocking vs. nice-to-have
   - Automated cleanse vs. manual review required

Output as data quality scorecard with red/yellow/green ratings and specific remediation backlog.`,

    expectedImprovement: 84,

    internalSymbols: [
      'Ξ.SYSTEM.MIGRATE.S4_READINESS',
      'Ξ.DATA.QUALITY.CUSTOMER_MASTER',
      'Ξ.DATA.QUALITY.MATERIAL_MASTER',
      'Ξ.INSIGHT.MIGRATE.DATA_GAPS',
      'Ξ.PROC.MIGRATE.REMEDIATION'
    ],

    insight: 'Material master has 23% records missing required packaging data for S/4 - discovered 6 months before migration with time to remediate vs. finding during cutover.',

    tags: ['system', 'migration', 'S/4HANA', 'data-quality', 'master-data', 'SAP-MDG']
  },

  {
    id: 'system-002',
    category: 'system',
    title: 'Admin Overhead Reduction',
    description: 'Identifies SAP administrative tasks that consume excessive effort and can be automated.',

    beforePrompt: 'SAP admin takes too much time.',

    afterPrompt: `Analyze SAP administrative overhead at TechGear Industries for reduction opportunities:

1. **Admin Activity Inventory**:
   | Activity | Frequency | Effort (hrs/month) | Skill Required | Owner |
   - User management (creates, changes, locks)
   - Authorization maintenance
   - Transport management
   - Job scheduling and monitoring
   - Performance monitoring
   - Backup verification
   - Patch/update application
   - Incident response

2. **Time Sink Analysis**:
   - Top 10 activities by total monthly hours
   - Repetitive tasks (same steps each time)
   - Reactive vs. proactive split
   - After-hours/weekend requirements

3. **Automation Opportunities**:
   For each high-effort activity:
   - Automation feasibility (native SAP, third-party, custom)
   - Implementation effort estimate
   - Ongoing maintenance requirement
   - Risk of automation (what could go wrong?)

4. **Self-Service Opportunities**:
   - What could users do themselves with proper tools?
   - Password resets, simple role requests, report access
   - Training requirement for self-service

5. **Optimization Recommendations**:
   | Initiative | Current Hours | Target Hours | Savings | Implementation Cost |
   - Prioritize by (Hours Saved / Implementation Effort)

Output as admin workload dashboard with specific automation/self-service roadmap.`,

    expectedImprovement: 71,

    internalSymbols: [
      'Ξ.SYSTEM.ADMIN.WORKLOAD',
      'Ξ.PERSON.IT_ADMIN.IT_045',
      'Ξ.METRIC.ADMIN.HOURS_MONTHLY',
      'Ξ.INSIGHT.ADMIN.AUTOMATION_OPP',
      'Ξ.PROC.ADMIN.USER_MGMT'
    ],

    insight: 'User provisioning consumes 35 hours/month due to manual email chains - implementing IDM workflow could reduce to 5 hours while improving audit trail.',

    tags: ['system', 'administration', 'automation', 'efficiency', 'SAP-basis', 'IDM']
  },

  {
    id: 'system-003',
    category: 'system',
    title: 'Integration Dependency Mapping',
    description: 'Maps all integration points to understand risk and plan for migration/changes.',

    beforePrompt: 'What systems connect to SAP?',

    afterPrompt: `Create comprehensive integration dependency map for TechGear Industries SAP landscape:

1. **Integration Inventory**:

   | External System | Direction | Integration Type | Frequency | Volume | Criticality |
   | CRM | SAP -> CRM | IDoc | Real-time | 500/day | High |
   | Warehouse | Bidirectional | RFC | Real-time | 2000/day | Critical |
   | EDI | Inbound/Outbound | IDoc | Batch | 300/day | High |
   | Banking | Outbound | File | Daily | 50/day | Critical |
   | Tax Engine | Call-out | BAPI | Real-time | 1000/day | High |

2. **Technical Details** per integration:
   - Communication method (IDoc, RFC, BAPI, file, API)
   - Authentication mechanism
   - Error handling approach
   - Monitoring in place (Y/N)
   - Last failure and resolution time

3. **Dependency Analysis**:
   - What breaks if SAP is down?
   - What breaks if external system is down?
   - Circular dependencies
   - Single points of failure in integration layer

4. **Risk Assessment**:
   - Integrations with no error alerting
   - Integrations with no retry mechanism
   - Integrations using deprecated protocols
   - Undocumented integrations (shadow IT)

5. **Migration Impact**:
   - Which integrations need changes for S/4?
   - Effort estimate per integration
   - Vendor coordination required

Output as integration architecture diagram plus risk-ranked integration backlog.`,

    expectedImprovement: 78,

    internalSymbols: [
      'Ξ.SYSTEM.INTEG.LANDSCAPE',
      'Ξ.SYSTEM.INTEG.WMS_RFC',
      'Ξ.SYSTEM.INTEG.EDI_IDOC',
      'Ξ.INSIGHT.INTEG.RISK_GAPS',
      'Ξ.RISK.INTEG.SPOF'
    ],

    insight: 'Discovered 3 undocumented file-based integrations created by business users - critical for commission calculation but no monitoring, no error handling, and not on S/4 migration plan.',

    tags: ['system', 'integration', 'architecture', 'dependency', 'migration', 'SAP-PI/PO']
  },

  {
    id: 'system-004',
    category: 'system',
    title: 'Post-Migration Role Cleanup',
    description: 'Identifies authorization cleanup needed after system migration to reduce risk.',

    beforePrompt: 'Clean up roles after the migration.',

    afterPrompt: `Conduct post-S/4HANA migration authorization cleanup for TechGear Industries:

1. **Obsolete Authorization Identification**:
   - T-codes that no longer exist in S/4 (but still in roles)
   - Authorization objects deprecated in S/4
   - Custom transactions not migrated
   - Roles referencing non-existent org values

2. **Role Usage Analysis** (30 days post-migration):
   | Role | Assigned Users | Active Users | T-codes Used | T-codes Unused |
   - Identify roles with 0 active users
   - Identify roles with <10% T-code utilization
   - Identify duplicate/similar roles that could merge

3. **New Authorization Gaps**:
   - Users reporting "no authorization" errors
   - New Fiori apps without role assignment
   - S/4 specific transactions not yet in roles

4. **Compliance Re-validation**:
   - SoD conflicts introduced by migration
   - Sensitive access that slipped through conversion
   - Privileged access that should have been temporary

5. **Cleanup Roadmap**:
   | Priority | Action | Roles Affected | Risk | Effort |
   - P1: Remove obsolete (no impact, immediate)
   - P2: Consolidate similar (some testing)
   - P3: Redesign for Fiori (significant)

Output as role cleanup project plan with testing requirements and rollback procedures.`,

    expectedImprovement: 73,

    internalSymbols: [
      'Ξ.SYSTEM.AUTH.POST_MIGRATE',
      'Ξ.AUTH.ROLE.OBSOLETE_LIST',
      'Ξ.AUTH.ROLE.UNUSED_TCODE',
      'Ξ.INSIGHT.AUTH.CLEANUP_OPP',
      'Ξ.CONTROL.SOX.POST_MIGRATE'
    ],

    insight: 'Migration converted 847 roles but 156 contain references to transactions that no longer exist - plus discovered 23 users with full basis authorization that was supposed to be temporary for cutover.',

    tags: ['system', 'authorization', 'migration', 'cleanup', 'security', 'SAP-GRC']
  },

  // ============================================================
  // STRATEGIC DECISIONS (3 examples)
  // ============================================================

  {
    id: 'strategic-001',
    category: 'strategic',
    title: 'Labor Cost Reduction - Protect Critical Roles',
    description: 'Analyzes workforce reduction scenarios while identifying roles that must be protected.',

    beforePrompt: 'We need to reduce headcount by 10%.',

    afterPrompt: `Analyze workforce reduction scenarios for TechGear Industries with critical role protection:

1. **Critical Role Identification** - MUST PROTECT:
   - Single points of failure (unique skills/access)
   - Customer-facing roles with relationship value
   - Compliance-mandated positions
   - Revenue-generating roles (direct attribution)

   For each critical role:
   | Role | Incumbent | Why Critical | Risk if Lost | Protection Priority |

2. **Reduction Candidate Analysis**:
   For non-critical roles, assess:
   - Workload vs. capacity (underutilized roles)
   - Automation potential (role could be automated)
   - Consolidation opportunity (combine similar roles)
   - Outsourcing viability (non-core function)

3. **Scenario Modeling**:
   | Scenario | Roles Eliminated | Annual Savings | Risk Score | Service Impact |
   - Conservative (5% reduction, minimal risk)
   - Moderate (10% reduction, managed risk)
   - Aggressive (15% reduction, significant risk)

4. **Implementation Considerations**:
   - Knowledge transfer requirements before departure
   - Timing (avoid critical business periods)
   - Severance cost offset calculation
   - Morale impact on retained employees

5. **Recommended Approach**:
   - Specific roles to eliminate with rationale
   - Roles to protect at all costs
   - Phased timeline
   - Contingency if voluntary attrition insufficient

Output as confidential workforce planning document with financial model.`,

    expectedImprovement: 81,

    internalSymbols: [
      'Ξ.STRATEGIC.WORKFORCE.REDUCTION',
      'Ξ.PERSON.CRITICAL.PROTECT_LIST',
      'Ξ.INSIGHT.LABOR.AUTOMATION_CANDIDATE',
      'Ξ.RISK.WORKFORCE.SPOF_LOSS',
      'Ξ.METRIC.LABOR.COST_BY_ROLE'
    ],

    insight: 'Initial list included FIN_087 (senior finance role) due to high salary - analysis reveals they are only person with period-close authority and retirement risk makes them PROTECT priority instead.',

    tags: ['strategic', 'workforce', 'reduction', 'RIF', 'critical-roles', 'cost-reduction']
  },

  {
    id: 'strategic-002',
    category: 'strategic',
    title: 'Promotion Candidate Evaluation',
    description: 'Data-driven evaluation of internal candidates for leadership positions.',

    beforePrompt: 'Who should we promote to Operations Manager?',

    afterPrompt: `Evaluate internal candidates for Operations Manager position at TechGear Industries:

1. **Role Requirements Definition**:
   - Key responsibilities and scope
   - Required skills and experience
   - Leadership competencies needed
   - Stakeholder relationships required
   - SAP/system expertise expected

2. **Candidate Assessment Matrix**:

   | Candidate | Current Role | Tenure | Performance | Skills Match | Leadership Evidence |

   For each candidate, assess:
   - Historical performance ratings (3-year trend)
   - Project leadership experience
   - Cross-functional collaboration demonstrated
   - Team feedback/360 data
   - Development activities completed

3. **SAP Transaction Analysis** (objective data):
   - Volume and complexity of work managed
   - Error/rework rate vs. peers
   - Approval authority exercised
   - System expertise demonstrated

4. **Gap Analysis** per candidate:
   | Candidate | Strength Areas | Development Needs | Time to Ready |
   - What training/mentoring needed?
   - Interim assignments to close gaps?

5. **Succession Risk Assessment**:
   - If candidate promoted, who backfills?
   - Is current role more or less critical?
   - Net organizational risk of promotion

6. **Recommendation**:
   - Primary candidate with rationale
   - Backup candidate
   - Development plan for non-selected candidates

Output as talent review committee presentation with confidential supporting data.`,

    expectedImprovement: 77,

    internalSymbols: [
      'Ξ.STRATEGIC.TALENT.PROMO_EVAL',
      'Ξ.PERSON.CANDIDATE.OPS_205',
      'Ξ.PERSON.CANDIDATE.OPS_208',
      'Ξ.METRIC.PERFORMANCE.HISTORY',
      'Ξ.INSIGHT.TALENT.READINESS_GAP'
    ],

    insight: 'Popular candidate (OPS_205) has great relationships but SAP data shows 2.1x error rate of alternative candidate (OPS_208) - data-driven approach reveals capability gap not visible in interviews.',

    tags: ['strategic', 'talent', 'promotion', 'succession', 'leadership', 'HR']
  },

  {
    id: 'strategic-003',
    category: 'strategic',
    title: 'Vendor Consolidation Strategy',
    description: 'Strategic analysis of vendor portfolio for consolidation to improve terms and reduce complexity.',

    beforePrompt: 'Should we consolidate vendors?',

    afterPrompt: `Develop vendor consolidation strategy for TechGear Industries:

1. **Vendor Portfolio Analysis**:
   | Category | # Vendors | Total Spend | Top 3 Concentration | Avg PO Size |
   - Direct materials
   - Indirect/MRO
   - Services
   - Logistics
   - IT/Software

2. **Consolidation Opportunity Assessment** per category:
   - Fragmentation score (1=consolidated, 10=fragmented)
   - Duplicate capability overlap
   - Spend leverage potential (volume discount opportunity)
   - Quality variance across vendors
   - Geographic/delivery considerations

3. **Candidate Analysis**:
   For categories with fragmentation score >7:
   | Current Vendors | Combined Spend | Recommended Survivors | Rationale |
   - Preferred vendor selection criteria
   - Transition risk assessment
   - Estimated savings from consolidation

4. **Risk Mitigation**:
   - Single-source risk after consolidation
   - Backup vendor maintenance strategy
   - Quality SLAs and monitoring
   - Transition timeline and testing

5. **Implementation Roadmap**:
   | Phase | Category | Current | Target | Savings | Timeline |
   - Prioritize by (Savings Potential / Implementation Risk)
   - Quick wins vs. strategic initiatives

6. **Stakeholder Management**:
   - Internal users affected
   - Change management approach
   - Communication plan for exited vendors

Output as vendor rationalization business case with 3-year NPV calculation.`,

    expectedImprovement: 79,

    internalSymbols: [
      'Ξ.STRATEGIC.VENDOR.CONSOLIDATION',
      'Ξ.VENDOR.CATEGORY.INDIRECT_MRO',
      'Ξ.VENDOR.CATEGORY.LOGISTICS',
      'Ξ.METRIC.VENDOR.SPEND_CONCENTRATION',
      'Ξ.INSIGHT.VENDOR.LEVERAGE_OPP'
    ],

    insight: 'MRO category has 47 vendors for $8.2M spend - analysis shows top 5 could handle 90% of volume, consolidation would unlock $410K annual savings through volume pricing.',

    tags: ['strategic', 'vendor', 'consolidation', 'procurement', 'cost-reduction', 'SAP-MM']
  }
];

/**
 * Helper function to get examples by category
 */
export function getExamplesByCategory(category: SAPExample['category']): SAPExample[] {
  return sapExamples.filter(ex => ex.category === category);
}

/**
 * Helper function to get examples by tag
 */
export function getExamplesByTag(tag: string): SAPExample[] {
  return sapExamples.filter(ex => ex.tags.includes(tag));
}

/**
 * Helper function to get example by ID
 */
export function getExampleById(id: string): SAPExample | undefined {
  return sapExamples.find(ex => ex.id === id);
}

/**
 * Get all unique tags across examples
 */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  sapExamples.forEach(ex => ex.tags.forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

/**
 * Get category statistics
 */
export function getCategoryStats(): Record<SAPExample['category'], { count: number; avgImprovement: number }> {
  const categories: SAPExample['category'][] = ['personnel', 'financial', 'process', 'customer', 'system', 'strategic'];

  return categories.reduce((acc, category) => {
    const examples = getExamplesByCategory(category);
    const avgImprovement = examples.reduce((sum, ex) => sum + ex.expectedImprovement, 0) / examples.length;
    acc[category] = { count: examples.length, avgImprovement: Math.round(avgImprovement) };
    return acc;
  }, {} as Record<SAPExample['category'], { count: number; avgImprovement: number }>);
}
