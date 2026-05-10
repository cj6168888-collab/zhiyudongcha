import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  memberRows: [] as Array<Record<string, unknown>>,
  insertedAuditRows: [] as Array<Record<string, unknown>>,
}));

const collectorMock = vi.hoisted(() => ({
  collectAllBehavioralData: vi.fn(),
}));

vi.mock('../../../db', () => ({
  getDatabase: () => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(dbMock.memberRows),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation(async (row) => {
        dbMock.insertedAuditRows.push(row);
        return row;
      }),
    }),
  }),
}));

vi.mock('../../../services/risk-data-collector', () => ({
  riskDataCollector: collectorMock,
}));

import { riskPredictionService } from '../../../services/risk-prediction';

function lowBehavioralData() {
  return {
    accessPattern: { unusualHours: 0 },
    workPattern: { overtimeHours: 0, absenceDays: 0 },
    documentActivity: {
      downloadCount: 0,
      uploadCount: 0,
      printCount: 0,
      shareCount: 0,
    },
    networkBehavior: {
      jobSiteVisits: 0,
      linkedInActivity: 0,
      emailExternalCount: 0,
    },
  };
}

describe('RiskPredictionService', () => {
  beforeEach(() => {
    dbMock.memberRows = [
      {
        id: 'member-risk-1',
        name: 'Risk Member',
        accessTier: 'FULL',
      },
    ];
    dbMock.insertedAuditRows = [];
    collectorMock.collectAllBehavioralData.mockReset();
    collectorMock.collectAllBehavioralData.mockResolvedValue(lowBehavioralData());
  });

  it('throws when the member does not exist', async () => {
    dbMock.memberRows = [];

    await expect(riskPredictionService.assessMemberRisk('missing-member')).rejects.toThrow('成员不存在');
  });

  it('promotes severe document exfiltration signals to critical leak risk and creates an alert', async () => {
    collectorMock.collectAllBehavioralData.mockResolvedValue({
      ...lowBehavioralData(),
      accessPattern: { unusualHours: 4 },
      documentActivity: {
        downloadCount: 21,
        uploadCount: 11,
        printCount: 16,
        shareCount: 6,
      },
    });
    const listener = vi.fn();
    riskPredictionService.onAlert(listener);

    const profile = await riskPredictionService.assessMemberRisk('member-risk-1');

    const leakRisk = profile.risks.find((risk) => risk.type === 'LEAK');
    expect(profile.overallRisk).toBe('CRITICAL');
    expect(profile.riskScore).toBe(100);
    expect(leakRisk).toMatchObject({
      type: 'LEAK',
      level: 'CRITICAL',
      score: 100,
    });
    expect(leakRisk?.indicators.map((indicator) => indicator.id)).toEqual([
      'bulk_download',
      'cloud_upload',
      'print_sensitive',
      'email_forward',
      'off_hours_access',
    ]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'member-risk-1',
        riskType: 'LEAK',
        priority: 'CRITICAL',
        status: 'NEW',
      }),
    );
    expect(dbMock.insertedAuditRows).toContainEqual(
      expect.objectContaining({
        actor: 'SYSTEM',
        action: 'RISK_ALERT_CREATED',
        targetType: 'MEMBER',
        targetId: 'member-risk-1',
        result: 'SUCCESS',
      }),
    );

    riskPredictionService.offAlert(listener);
  });

  it('promotes resignation signals from real behavioral data to high risk', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    collectorMock.collectAllBehavioralData.mockResolvedValue({
      ...lowBehavioralData(),
      networkBehavior: {
        jobSiteVisits: 8,
        linkedInActivity: 5,
        emailExternalCount: 0,
      },
      workPattern: {
        overtimeHours: 24,
        absenceDays: 7,
      },
    });

    const profile = await riskPredictionService.assessMemberRisk('member-risk-1');

    const resignationRisk = profile.risks.find((risk) => risk.type === 'RESIGNATION');
    expect(resignationRisk).toMatchObject({
      type: 'RESIGNATION',
      level: 'HIGH',
      score: 70,
    });
    expect(resignationRisk?.indicators.map((indicator) => indicator.id)).toEqual([
      'job_search',
      'linkedin_activity',
      'reduced_engagement',
      'increased_sick_days',
    ]);
    expect(await riskPredictionService.getAlerts({ riskType: 'RESIGNATION', priority: 'URGENT' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: 'member-risk-1',
          riskType: 'RESIGNATION',
          priority: 'URGENT',
        }),
      ]),
    );
  });

  it('detects deterministic simulated fraud and conflict indicators', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const fraudProfile = await riskPredictionService.assessMemberRisk('member-23-3');
    const conflictProfile = await riskPredictionService.assessMemberRisk('member-29-12');

    const fraudRisk = fraudProfile.risks.find((risk) => risk.type === 'FRAUD');
    const conflictRisk = conflictProfile.risks.find((risk) => risk.type === 'CONFLICT');
    expect(fraudRisk).toMatchObject({
      type: 'FRAUD',
      level: 'LOW',
      score: 10,
    });
    expect(fraudRisk?.indicators[0]).toMatchObject({
      id: 'expense_anomaly',
      rawData: { amount: 5000, avgAmount: 2000 },
    });
    expect(conflictRisk).toMatchObject({
      type: 'CONFLICT',
      level: 'LOW',
      score: 10,
    });
    expect(conflictRisk?.indicators[0]).toMatchObject({
      id: 'email_escalation',
      rawData: { escalations: 3, period: '1month' },
    });
  });

  it('promotes deterministic burnout signals to high risk and exposes risk stats', async () => {
    const randomValues = [0.5, 0.5, 0.5, 0.9, 0.8, 0.1, 0.5, 0.5];
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues.shift() ?? 0.5);

    const profile = await riskPredictionService.assessMemberRisk('member-risk-1');

    const burnoutRisk = profile.risks.find((risk) => risk.type === 'BURNOUT');
    expect(burnoutRisk).toMatchObject({
      type: 'BURNOUT',
      level: 'HIGH',
      score: 60,
    });
    expect(burnoutRisk?.indicators.map((indicator) => indicator.id)).toEqual([
      'high_workload',
      'excessive_overtime',
      'no_vacation',
    ]);

    const stats = await riskPredictionService.getRiskStats();
    expect(stats.totalAssessed).toBeGreaterThanOrEqual(1);
    expect(stats.byType.BURNOUT).toBeGreaterThanOrEqual(1);
    expect(stats.activeAlerts).toBeGreaterThanOrEqual(1);
  });

  it('returns cached profiles and sorts high-risk members by score', async () => {
    collectorMock.collectAllBehavioralData.mockResolvedValue({
      ...lowBehavioralData(),
      documentActivity: {
        downloadCount: 21,
        uploadCount: 11,
        printCount: 16,
        shareCount: 6,
      },
    });

    const profile = await riskPredictionService.assessMemberRisk('member-risk-1');
    const cached = await riskPredictionService.getMemberProfile('member-risk-1');
    const highRisk = await riskPredictionService.getHighRiskMembers();

    expect(cached).toBe(profile);
    expect(highRisk[0]).toMatchObject({
      memberId: 'member-risk-1',
      overallRisk: 'CRITICAL',
    });
  });

  it('supports alert acknowledgement and ignores unknown alerts', async () => {
    collectorMock.collectAllBehavioralData.mockResolvedValue({
      ...lowBehavioralData(),
      documentActivity: {
        downloadCount: 21,
        uploadCount: 11,
        printCount: 16,
        shareCount: 6,
      },
    });
    await riskPredictionService.assessMemberRisk('member-risk-1');
    const [alert] = await riskPredictionService.getAlerts({ riskType: 'LEAK' });

    expect(await riskPredictionService.acknowledgeAlert(alert.id, 'MASTER')).toBe(true);
    expect(await riskPredictionService.acknowledgeAlert('missing-alert', 'MASTER')).toBe(false);

    const [acknowledged] = await riskPredictionService.getAlerts({ status: 'ACKNOWLEDGED' });
    expect(acknowledged.id).toBe(alert.id);
    expect(acknowledged.acknowledgedAt).toBeInstanceOf(Date);
  });

  it('describes known risk types', () => {
    expect(riskPredictionService.getRiskTypeDescription('LEAK')).toContain('泄密风险');
  });
});
