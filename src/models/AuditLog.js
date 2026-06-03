import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete', 'login', 'logout', 'upload', 'approve', 'spam'],
    },
    entity: {
      type: String,
      required: true,
      enum: ['post', 'page', 'category', 'tag', 'media', 'comment', 'user', 'setting', 'theme'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performerName: {
      type: String,
      default: 'system',
    },
    ip: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, action: 1 });
auditLogSchema.index({ performedBy: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/**
 * Log an admin action.
 * @param {Object} params
 * @param {string} params.action - create | update | delete | login | logout | upload | approve | spam
 * @param {string} params.entity - post | page | category | tag | media | comment | user | setting
 * @param {ObjectId} [params.entityId] - The ID of the affected record
 * @param {string} [params.description] - Human-readable description
 * @param {Object} [params.req] - Express request object (to extract user + IP)
 * @param {Object} [params.metadata] - Extra data to store
 */
AuditLog.log = async function ({ action, entity, entityId, description, req, metadata = {} }) {
  try {
    await this.create({
      action,
      entity,
      entityId: entityId || null,
      description: description || `${action} ${entity}`,
      performedBy: req?.session?.userId || null,
      performerName: req?.session?.username || 'system',
      ip: req?.ip || req?.connection?.remoteAddress || '',
      metadata,
    });
  } catch (err) {
    console.error('AuditLog error:', err);
  }
};

export default AuditLog;
