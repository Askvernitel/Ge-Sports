import { KycRecord, type KycRecordDoc } from '../models/KycRecord.js';

export const kycRepo = {
  async create(data: Record<string, unknown>): Promise<KycRecordDoc> {
    return KycRecord.create(data);
  },
  async findLatestForUser(userId: string) {
    return KycRecord.findOne({ userId }).sort({ createdAt: -1 }).exec();
  },
  async findByProviderRef(providerRefId: string) {
    return KycRecord.findOne({ providerRefId }).exec();
  },
  async updateById(id: string, update: Record<string, unknown>) {
    return KycRecord.findByIdAndUpdate(id, update, { new: true }).exec();
  },
  async listPending(page: number, limit: number) {
    const query = { status: 'pending' };
    const [items, total] = await Promise.all([
      KycRecord.find(query)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      KycRecord.countDocuments(query),
    ]);
    return { items, total };
  },
};
