import { Controller, Get, Res, Request } from '@nestjs/common';
import type { Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

/**
 * Serves the Communication panel HTML at GET /admin/panel.
 *
 * Roles:
 *   TIKIT_ADMIN   — all-schools table + allocation edit modal
 *   SCHOOL_ADMIN — read-only view of their own school only
 *
 * The page calls existing REST endpoints:
 *   GET  /v1/admin/communication-usage                        (TIKIT_ADMIN)
 *   GET  /v1/admin/schools/:id/communication-usage            (both roles)
 *   PATCH /v1/admin/schools/:id/communication-allocation      (TIKIT_ADMIN)
 *
 * TODO(future): add pushTransactionalUsed / emailTransactionalUsed /
 * smsTransactionalUsed columns to the table when those fields land in schema.
 */
@ApiExcludeController()
@Controller('admin/panel')
export class AdminPanelController {
  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  servePanel(@Res() res: Response, @Request() req: any) {
    const role: string = req.user?.role ?? '';
    const schoolId: string = req.user?.schoolId ?? '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildHtml(role, schoolId));
  }
}

// ─── HTML factory ─────────────────────────────────────────────────────────────

function buildHtml(role: string, schoolId: string): string {
  // Safely inject server-side values as JS literals — no user-controlled strings
  // other than role (enum) and schoolId (UUID from validated JWT).
  const userJson = JSON.stringify({ role, schoolId });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>TiKit — Communication Usage</title>
  <link rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
    crossorigin="anonymous"/>
  <style>
    body { background:#f8f9fa; }
    .quota-bar { height:8px; background:#dee2e6; border-radius:4px; overflow:hidden; }
    .quota-fill { height:100%; border-radius:4px; transition:width .3s; }
  </style>
</head>
<body>
<nav class="navbar navbar-dark bg-dark mb-4 px-4 d-flex justify-content-between">
  <span class="navbar-brand fw-bold">TiKit &mdash; Communication Usage</span>
  <span class="badge bg-secondary text-uppercase" id="role-badge"></span>
</nav>

<div class="container-fluid px-4">
  <div id="table-wrapper">
    <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
  </div>
</div>

<!-- Edit modal — rendered only for TIKIT_ADMIN -->
<div class="modal fade" id="editModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Edit Allocation — <span id="modal-school-name"></span></h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="modal-school-id"/>
        <div class="row g-3">
          <div class="col-12"><h6 class="text-muted">Push Notifications</h6></div>
          <div class="col-6">
            <label class="form-label">Allocated</label>
            <input id="f-pushAllocated" type="number" min="0" class="form-control"/>
          </div>
          <div class="col-6">
            <label class="form-label">Price / msg</label>
            <input id="f-pushPrice" type="number" min="0" step="0.0001" class="form-control"/>
          </div>
          <div class="col-12"><h6 class="text-muted">Email</h6></div>
          <div class="col-6">
            <label class="form-label">Allocated</label>
            <input id="f-emailAllocated" type="number" min="0" class="form-control"/>
          </div>
          <div class="col-6">
            <label class="form-label">Price / msg</label>
            <input id="f-emailPrice" type="number" min="0" step="0.0001" class="form-control"/>
          </div>
          <div class="col-12"><h6 class="text-muted">SMS</h6></div>
          <div class="col-6">
            <label class="form-label">Allocated</label>
            <input id="f-smsAllocated" type="number" min="0" class="form-control"/>
          </div>
          <div class="col-6">
            <label class="form-label">Price / msg</label>
            <input id="f-smsPrice" type="number" min="0" step="0.0001" class="form-control"/>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" id="save-btn" onclick="saveAllocation()">Save</button>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
  crossorigin="anonymous"></script>
<script>
  // Injected server-side from validated JWT — no user input
  const USER = ${userJson};
  const IS_SUPER = USER.role === 'TIKIT_ADMIN';
  const TOKEN = new URLSearchParams(window.location.search).get('token') || '';
  const BASE  = window.location.origin + '/v1';

  document.getElementById('role-badge').textContent = IS_SUPER ? 'Super Admin' : 'School Admin';

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN };
  }

  function bar(used, allocated) {
    if (allocated === 0) return '<span class="badge bg-danger">Blocked</span>';
    const pct = Math.min(100, Math.round((used / allocated) * 100));
    const cls = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-success';
    return \`<div class="quota-bar"><div class="quota-fill \${cls}" style="width:\${pct}%"></div></div>
            <small class="text-muted">\${used} / \${allocated} (\${allocated - used} left)</small>\`;
  }

  // ── TIKIT_ADMIN: all-schools table ─────────────────────────────────────────

  async function loadAll() {
    const res = await fetch(BASE + '/admin/communication-usage', { headers: authHeaders() });
    if (!res.ok) { renderError('Failed to load — check your Bearer token (?token=...).'); return; }
    const rows = await res.json();
    const tbody = rows.map(r => \`
      <tr>
        <td class="fw-semibold">\${esc(r.schoolName)}</td>
        <td>\${bar(r.pushUsed, r.pushAllocated)}</td>
        <td>\${bar(r.emailUsed, r.emailAllocated)}</td>
        <td>\${bar(r.smsUsed, r.smsAllocated)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary"
            onclick='openEdit(\${JSON.stringify(r)})'>Edit</button>
        </td>
      </tr>\`).join('');
    document.getElementById('table-wrapper').innerHTML = \`
      <table class="table table-bordered table-hover bg-white shadow-sm">
        <thead class="table-dark">
          <tr><th>School</th><th>Push</th><th>Email</th><th>SMS</th><th></th></tr>
        </thead>
        <tbody>\${tbody}</tbody>
      </table>\`;
  }

  // ── SCHOOL_ADMIN: own-school read-only card ────────────────────────────────

  async function loadMySchool() {
    const res = await fetch(BASE + '/admin/schools/' + USER.schoolId + '/communication-usage',
      { headers: authHeaders() });
    if (!res.ok) { renderError('Failed to load your school usage.'); return; }
    const d = await res.json();
    document.getElementById('table-wrapper').innerHTML = \`
      <div class="row g-4 justify-content-center">
        \${channelCard('Push Notifications', d.push)}
        \${channelCard('Email', d.email)}
        \${channelCard('SMS', d.sms)}
      </div>
      <p class="text-muted text-center mt-4 small">
        Contact your super admin to change allocation limits.
      </p>\`;
  }

  function channelCard(label, ch) {
    const pct = ch.allocated === 0 ? 0 : Math.min(100, Math.round((ch.used / ch.allocated) * 100));
    const cls = ch.allocated === 0 ? 'danger' : pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';
    const statusBadge = ch.allocated === 0
      ? '<span class="badge bg-danger ms-2">Blocked</span>'
      : '';
    return \`
      <div class="col-md-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title">\${label}\${statusBadge}</h6>
            <div class="quota-bar my-2">
              <div class="quota-fill bg-\${cls}" style="width:\${pct}%"></div>
            </div>
            <dl class="row mb-0 small">
              <dt class="col-6">Allocated</dt><dd class="col-6">\${ch.allocated}</dd>
              <dt class="col-6">Used</dt>     <dd class="col-6">\${ch.used}</dd>
              <dt class="col-6">Remaining</dt><dd class="col-6 fw-bold text-\${cls}">\${ch.remaining}</dd>
            </dl>
          </div>
        </div>
      </div>\`;
  }

  // ── Edit modal (TIKIT_ADMIN only) ──────────────────────────────────────────

  function openEdit(r) {
    document.getElementById('modal-school-id').value        = r.schoolId;
    document.getElementById('modal-school-name').textContent = r.schoolName;
    document.getElementById('f-pushAllocated').value        = r.pushAllocated;
    document.getElementById('f-emailAllocated').value       = r.emailAllocated;
    document.getElementById('f-smsAllocated').value         = r.smsAllocated;
    document.getElementById('f-pushPrice').value            = r.pushPrice  ?? '';
    document.getElementById('f-emailPrice').value           = r.emailPrice ?? '';
    document.getElementById('f-smsPrice').value             = r.smsPrice   ?? '';
    new bootstrap.Modal(document.getElementById('editModal')).show();
  }

  async function saveAllocation() {
    const id   = document.getElementById('modal-school-id').value;
    const body = {
      pushAllocated:  parseInt(document.getElementById('f-pushAllocated').value)  || 0,
      emailAllocated: parseInt(document.getElementById('f-emailAllocated').value) || 0,
      smsAllocated:   parseInt(document.getElementById('f-smsAllocated').value)   || 0,
    };
    const push  = parseFloat(document.getElementById('f-pushPrice').value);
    const email = parseFloat(document.getElementById('f-emailPrice').value);
    const sms   = parseFloat(document.getElementById('f-smsPrice').value);
    if (!isNaN(push))  body.pushPrice  = push;
    if (!isNaN(email)) body.emailPrice = email;
    if (!isNaN(sms))   body.smsPrice   = sms;

    document.getElementById('save-btn').disabled = true;
    const res = await fetch(BASE + '/admin/schools/' + id + '/communication-allocation', {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    document.getElementById('save-btn').disabled = false;
    if (res.ok) {
      bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
      await loadAll();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Save failed: ' + (err.message || res.status));
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function renderError(msg) {
    document.getElementById('table-wrapper').innerHTML =
      '<div class="alert alert-danger">' + esc(msg) + '</div>';
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  IS_SUPER ? loadAll() : loadMySchool();
</script>
</body>
</html>`;
}
