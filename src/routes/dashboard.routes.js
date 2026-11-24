import { Router } from 'express';
import { Client } from '../models/Client.js';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

function aggregateResult(rows) {
  return {
    total: rows[0]?.total ?? 0,
    count: rows[0]?.count ?? 0,
  };
}

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesMatch = { status: { $ne: 'anulada' } };

    const [
      clients,
      products,
      lowStock,
      users,
      salesTodayRows,
      salesMonthRows,
      recentSales,
      lowStockProducts,
    ] = await Promise.all([
      Client.countDocuments({ active: true }),
      Product.countDocuments({ active: true }),
      Product.countDocuments({
        active: true,
        $expr: { $lte: ['$stock', '$minStock'] },
      }),
      User.countDocuments({ active: true }),
      Sale.aggregate([
        {
          $match: {
            ...salesMatch,
            createdAt: { $gte: startOfDay },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
      ]),
      Sale.aggregate([
        {
          $match: {
            ...salesMatch,
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
      ]),
      Sale.find()
        .populate('client', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
      Product.find({
        active: true,
        $expr: { $lte: ['$stock', '$minStock'] },
      })
        .sort({ stock: 1 })
        .limit(5)
        .select('name sku stock minStock'),
    ]);

    res.json({
      clients,
      products,
      lowStock,
      users,
      salesToday: aggregateResult(salesTodayRows),
      salesMonth: aggregateResult(salesMonthRows),
      recentSales,
      lowStockProducts,
    });
  })
);

export default router;
