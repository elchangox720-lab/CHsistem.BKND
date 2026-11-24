import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'La venta debe tener al menos un producto',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pagada', 'pendiente', 'anulada'],
      default: 'pagada',
    },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ client: 1, createdAt: -1 });
saleSchema.index({ status: 1, createdAt: -1 });
saleSchema.set('toJSON', { versionKey: false });

export const Sale = mongoose.model('Sale', saleSchema);
