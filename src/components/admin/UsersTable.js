// src/components/admin/UsersTable.jsx
import React, { useState } from 'react';
import { Table, Button, Badge, Modal } from 'react-bootstrap';

export default function UsersTable({
  users = [],
  onEdit,
  onToggleBan,   // function(user, banBoolean)
  onSoftDelete,  // function(user)
  onRestore,     // function(user)
  pagination = null // optional: { page, pages, onPageChange }
}) {
  const [confirm, setConfirm] = useState({ show: false, action: null, user: null });

  const openConfirm = (action, user) => setConfirm({ show: true, action, user });
  const closeConfirm = () => setConfirm({ show: false, action: null, user: null });

  const handleConfirm = async () => {
    const { action, user } = confirm;
    closeConfirm();
    if (!user) return;
    try {
      if (action === 'ban') {
        await onToggleBan?.(user, true);
      } else if (action === 'unban') {
        await onToggleBan?.(user, false);
      } else if (action === 'delete') {
        await onSoftDelete?.(user);
      } else if (action === 'restore') {
        await onRestore?.(user);
      }
    } catch (err) {
      // parent handlers should handle errors; we swallow here
      // optionally show a toast
      // console.error(err);
    }
  };

  return (
    <div className="mt-3">
      <Table striped hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const isDeleted = !!u.deleted_at;
            const isBanned = !!u.banned;
            return (
              <tr key={u.id} className={isDeleted ? 'table-secondary' : ''}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>
                  <Badge bg={u.role === 'admin' ? 'danger' : u.role === 'artist' ? 'success' : 'primary'}>
                    {u.role}
                  </Badge>
                </td>
                <td>
                  {isDeleted ? (
                    <Badge bg="secondary">Deleted</Badge>
                  ) : isBanned ? (
                    <Badge bg="danger">Banned</Badge>
                  ) : (
                    <Badge bg="success">Active</Badge>
                  )}
                </td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                <td>
                  {!isDeleted && (
                    <>
                      <Button size="sm" onClick={() => onEdit?.(u)}>Edit</Button>{' '}
                      <Button
                        size="sm"
                        variant={isBanned ? 'success' : 'danger'}
                        onClick={() => openConfirm(isBanned ? 'unban' : 'ban', u)}
                      >
                        {isBanned ? 'Unban' : 'Ban'}
                      </Button>{' '}
                      <Button size="sm" variant="outline-danger" onClick={() => openConfirm('delete', u)}>Delete</Button>
                    </>
                  )}

                  {isDeleted && (
                    <Button size="sm" variant="outline-primary" onClick={() => openConfirm('restore', u)}>Restore</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {/* confirmation modal */}
      <Modal show={confirm.show} onHide={closeConfirm} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {confirm.action === 'ban' && 'Ban user'}
            {confirm.action === 'unban' && 'Unban user'}
            {confirm.action === 'delete' && 'Delete user'}
            {confirm.action === 'restore' && 'Restore user'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirm.user ? (
            <div>
              Are you sure you want to <strong>{confirm.action}</strong> <strong>{confirm.user.username}</strong> (id: {confirm.user.id})?
              {confirm.action === 'delete' && <div className="text-muted mt-2">This will soft-delete the user (recoverable).</div>}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeConfirm}>Cancel</Button>
          <Button variant={confirm.action === 'delete' ? 'danger' : 'primary'} onClick={handleConfirm}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>

      {/* optional simple pagination controls */}
      {pagination && pagination.pages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div>Page {pagination.page} of {pagination.pages}</div>
          <div>
            <Button size="sm" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)}>Prev</Button>{' '}
            <Button size="sm" disabled={pagination.page >= pagination.pages} onClick={() => pagination.onPageChange(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}