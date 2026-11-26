import mongoose from 'mongoose';

const specSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: String, required: true, trim: true, maxlength: 160 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    category: { type: String, trim: true, maxlength: 60, default: '' },
    brand: { type: String, trim: true, maxlength: 80, default: '' },
    model: { type: String, trim: true, maxlength: 80, default: '' },
    specs: { type: [specSchema], default: [] },
    price: { type: Number, required: true, min: 0, default: 0 },
    cost: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    minStock: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1, model: 1, name: 1 });
productSchema.set('toJSON', { versionKey: false });

export const Product = mongoose.model('Product', productSchema);
