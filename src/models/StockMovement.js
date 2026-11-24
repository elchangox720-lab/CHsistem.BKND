import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['entrada', 'salida', 'ajuste'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, maxlength: 200, default: '' },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.set('toJSON', { versionKey: false });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
