import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../storage', () => ({
  storage: {
    getEmail: vi.fn(),
    createEmail: vi.fn(),
    getEmailAttachments: vi.fn(),
    getEmailsByAccount: vi.fn(),
    getEmailStats: vi.fn(),
    updateEmail: vi.fn(),
    deleteEmail: vi.fn(),
    getAllEmails: vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { EmailService } from '../../../services/EmailService';
import { storage } from '../../../storage';

const baseEmail = {
  id: 'email-1',
  accountId: 'account-1',
  subject: '发布准备',
  folder: 'inbox',
  status: 'unread',
  category: 'work',
};

const baseAttachment = {
  id: 'attachment-1',
  emailId: 'email-1',
  fileName: 'release-plan.md',
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService();
    vi.clearAllMocks();

    vi.mocked(storage.getEmail).mockResolvedValue(baseEmail as any);
    vi.mocked(storage.createEmail).mockResolvedValue(baseEmail as any);
    vi.mocked(storage.getEmailAttachments).mockResolvedValue([baseAttachment] as any);
    vi.mocked(storage.getEmailsByAccount).mockResolvedValue([baseEmail] as any);
    vi.mocked(storage.getEmailStats).mockResolvedValue({ total: 1, unread: 1 } as any);
    vi.mocked(storage.updateEmail).mockResolvedValue(baseEmail as any);
    vi.mocked(storage.deleteEmail).mockResolvedValue(true);
    vi.mocked(storage.getAllEmails).mockResolvedValue([baseEmail] as any);
  });

  it('delegates email detail, creation, attachments, account listing, and stats', async () => {
    await expect(service.getEmail('email-1')).resolves.toEqual(baseEmail);
    await expect(service.createEmail({ accountId: 'account-1', subject: '发布准备' } as any)).resolves.toEqual(
      baseEmail,
    );
    await expect(service.getEmailAttachments('email-1')).resolves.toEqual([baseAttachment]);
    await expect(service.getEmailsByAccount('account-1', 'inbox', 20)).resolves.toEqual([baseEmail]);
    await expect(service.getEmailStats()).resolves.toEqual({ total: 1, unread: 1 });

    expect(storage.getEmail).toHaveBeenCalledWith('email-1');
    expect(storage.createEmail).toHaveBeenCalledWith({
      accountId: 'account-1',
      subject: '发布准备',
    });
    expect(storage.getEmailAttachments).toHaveBeenCalledWith('email-1');
    expect(storage.getEmailsByAccount).toHaveBeenCalledWith('account-1', 'inbox', 20);
    expect(storage.getEmailStats).toHaveBeenCalledWith();
  });

  it('updates emails and returns undefined when the email is missing', async () => {
    await expect(service.updateEmail('email-1', { status: 'read' } as any)).resolves.toEqual(baseEmail);
    expect(storage.updateEmail).toHaveBeenCalledWith('email-1', { status: 'read' });

    vi.mocked(storage.updateEmail).mockResolvedValueOnce(undefined);
    await expect(service.updateEmail('missing', { status: 'read' } as any)).resolves.toBeUndefined();
  });

  it('deletes emails and returns storage success status', async () => {
    await expect(service.deleteEmail('email-1')).resolves.toBe(true);
    expect(storage.deleteEmail).toHaveBeenCalledWith('email-1');

    vi.mocked(storage.deleteEmail).mockResolvedValueOnce(false);
    await expect(service.deleteEmail('missing')).resolves.toBe(false);
  });

  it('forwards all-email filters directly to storage', async () => {
    const options = {
      accountId: 'account-1',
      category: 'work',
      status: 'unread',
      fromDate: new Date('2026-05-01T00:00:00.000Z'),
      toDate: new Date('2026-05-10T00:00:00.000Z'),
      limit: 50,
    };

    await expect(service.getAllEmails(options)).resolves.toEqual([baseEmail]);
    expect(storage.getAllEmails).toHaveBeenCalledWith(options);
  });
});
