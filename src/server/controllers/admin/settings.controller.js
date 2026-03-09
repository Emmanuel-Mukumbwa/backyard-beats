// src/server/controllers/admin/settings.controller.js
/**
 * Simple settings controller. Currently returns fallback settings.
 * If you want persisted settings, create a `settings` table and update these methods.
 */

exports.getSettings = async (req, res, next) => {
  try {
    const settings = {
      siteName: process.env.SITE_NAME || 'BackyardBeats',
      maintenanceMode: false
    };
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const payload = req.body || {};
    // Placeholder: validate payload and persist to DB if you add a settings table.
    // For now, just echo success.
    res.json({ success: true, settings: payload });
  } catch (err) {
    next(err);
  }
};