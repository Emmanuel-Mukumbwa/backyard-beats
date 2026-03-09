//src/components/admin/SettingsPanel.js
import React from 'react';
import { Card, Button } from 'react-bootstrap';

/**
 * Simple presentational settings panel.
 *
 * Props:
 *  - settings: { siteName, maintenanceMode, ... }
 *  - onEdit: callback to open edit modal in parent
 */
export default function SettingsPanel({ settings = {}, onEdit }) {
  return (
    <div className="mt-3">
      <Button onClick={onEdit}>Edit Settings</Button>
      <Card className="mt-3">
        <Card.Body>
          <p><strong>Site Name:</strong> {settings.siteName}</p>
          <p><strong>Maintenance Mode:</strong> {settings.maintenanceMode ? 'Enabled' : 'Disabled'}</p>
        </Card.Body>
      </Card>
    </div>
  );
}