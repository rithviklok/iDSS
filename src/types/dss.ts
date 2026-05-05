// ========== DSS Rule Engine Types ==========

export type DSSRuleStatus = 'active' | 'triggered' | 'executed' | 'closed';
export type ConditionLogic = 'AND' | 'OR';
export type DataSource = 'sensor' | 'complaint' | 'cctv' | 'forecast' | 'manual' | 'iot';
export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'spike' | 'cluster';
export type TriggerSeverity = 'severe' | 'moderate' | 'advisory';
export type TriggerStatus = 'awaiting_approval' | 'in_progress' | 'completed' | 'failed' | 'escalated';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

export interface RuleCondition {
    id: string;
    source: DataSource;
    parameter: string;
    operator: ConditionOperator;
    threshold: number | string;
    duration?: string;
    logic: ConditionLogic;
    spatialFilter?: string;
}

export interface ApprovalStep {
    role: string;
    name: string;
    status: ApprovalStatus;
    timestamp?: string;
}

export interface RuleIntervention {
    id: string;
    name: string;
    estimatedCost: number; // in ₹
    budgetCode: string;
    fundSource: string;
}

export interface ImpactMetrics {
    estimatedPollutantReduction: string;
    affectedPopulation: number;
    impactedSchools?: number;
    healthBenefit: string;
}

export interface DSSRule {
    id: string;
    name: string;
    description: string;
    status: DSSRuleStatus;
    conditions: RuleCondition[];
    interventions: RuleIntervention[];
    workflowChain: string[];   // e.g. ['JE', 'AE', 'Executive Engineer']
    department: string;
    slaHours: number;
    approvalMode: 'auto' | 'manual';
    triggerCount: number;
    impactMetrics: ImpactMetrics;
}

export interface TriggeredRule {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: TriggerSeverity;
    sources: string[];
    activatedAt: string;
    ward: string;
    zoneName?: string | null;
    wardNames?: string[];
    wind?: string | null;
    detectedBy?: string | null;
    currentReading: string;
    timeExceeded: string;
    suggestedInterventions: string[];
    department: string;
    slaDeadline: string;
    status: TriggerStatus;
    approvalChain: ApprovalStep[];
    budgetImpact: number; // ₹
    capacityNote: string;
    affectedWards?: string[];
}

export interface DepartmentCapacity {
    department: string;
    resources: { name: string; total: number; available: number; deployed: number }[];
    pendingActions: number;
    avgResponseTime: string;
    slaCompliance: number; // %
    overdueCount: number;
    budgetUtilized: number; // ₹
    budgetAllocated: number; // ₹
}

export interface SimulationResult {
    ruleId: string;
    ruleName: string;
    triggerCount: number;
    avgSlaAdherence: number;
    estimatedReduction: string;
    budgetSpend: number;
    topCategory: string;
}

export type DSSTab = 'triggers' | 'rules' | 'sensor-health' | 'capacity';
