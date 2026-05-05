import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, Edit2, Trash2, X } from 'lucide-react';
import {
    fetchManagedSensors,
    createSensor,
    updateSensor,
    deleteSensor,
    bulkImportSensors,
} from '../services/configuratorApi';
import type { ManagedSensor } from '../services/configuratorApi';

function NetworkBadge({ network }: { network: string }) {
    const colors: Record<string, { bg: string; text: string }> = {
        CAAQMS: { bg: 'rgba(99,102,241,0.12)', text: '#6366f1' },
        'Low-cost PM2.5': { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
        AWS: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
    };
    const c = colors[network] || { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' };
    return (
        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.text, fontSize: '0.72rem', fontWeight: 600 }}>
            {network}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const isActive = status === 'Active';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
            background: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: isActive ? '#10b981' : '#ef4444',
        }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#10b981' : '#ef4444' }} />
            {status}
        </span>
    );
}

interface SensorFormData {
    id: string;
    name: string;
    lat: string;
    lng: string;
    deviceType: string;
    wardNumber: string;
    zone: string;
}

const emptyForm: SensorFormData = { id: '', name: '', lat: '', lng: '', deviceType: '', wardNumber: '', zone: '' };

export default function ManageSensors() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const limit = 10;

    const { data, isLoading } = useQuery({
        queryKey: ['managed-sensors', page, limit],
        queryFn: () => fetchManagedSensors(page, limit),
    });

    const sensors: ManagedSensor[] = data?.sensors || [];
    const pagination = data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 };

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSensor, setEditingSensor] = useState<ManagedSensor | null>(null);
    const [form, setForm] = useState<SensorFormData>(emptyForm);
    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [importMsg, setImportMsg] = useState('');

    const openAdd = () => {
        setForm(emptyForm);
        setFormError('');
        setShowAddModal(true);
        setEditingSensor(null);
    };

    const openEdit = (s: ManagedSensor) => {
        setForm({
            id: s.id,
            name: s.name,
            lat: String(s.lat),
            lng: String(s.lng),
            deviceType: s.deviceType || '',
            wardNumber: s.ward != null ? String(s.ward) : '',
            zone: s.zoneId != null ? String(s.zoneId) : '',
        });
        setFormError('');
        setEditingSensor(s);
        setShowAddModal(true);
    };

    const handleSubmit = async () => {
        setFormError('');
        if (!form.id || !form.lat || !form.lng) {
            setFormError('ID, Latitude, and Longitude are required');
            return;
        }
        setFormLoading(true);
        try {
            if (editingSensor) {
                await updateSensor(editingSensor.id, {
                    name: form.name || undefined,
                    lat: parseFloat(form.lat),
                    lng: parseFloat(form.lng),
                    deviceType: form.deviceType || undefined,
                    wardNumber: form.wardNumber ? parseInt(form.wardNumber, 10) : undefined,
                    zone: form.zone ? parseInt(form.zone, 10) : undefined,
                });
            } else {
                await createSensor({
                    id: form.id,
                    name: form.name || form.id,
                    lat: parseFloat(form.lat),
                    lng: parseFloat(form.lng),
                    deviceType: form.deviceType || undefined,
                    wardNumber: form.wardNumber ? parseInt(form.wardNumber, 10) : undefined,
                    zone: form.zone ? parseInt(form.zone, 10) : undefined,
                });
            }
            setShowAddModal(false);
            setEditingSensor(null);
            queryClient.invalidateQueries({ queryKey: ['managed-sensors'] });
        } catch (err) {
            setFormError((err as Error).message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteSensor(id);
            setDeleteConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['managed-sensors'] });
        } catch (err) {
            alert((err as Error).message);
        }
    };

    const handleCsvImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            setImportMsg('Importing...');
            try {
                const result = await bulkImportSensors(file);
                setImportMsg(result.message);
                queryClient.invalidateQueries({ queryKey: ['managed-sensors'] });
                setTimeout(() => setImportMsg(''), 5000);
            } catch (err) {
                setImportMsg(`Error: ${(err as Error).message}`);
            }
        };
        input.click();
    };

    return (
        <div className="cfg-page">
            <div className="cfg-page-header">
                <div>
                    <h1 className="cfg-page-title">Manage Sensors</h1>
                    <p className="cfg-page-subtitle">Add, edit, or deactivate sensors</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {importMsg && <span style={{ fontSize: '0.8rem', color: importMsg.startsWith('Error') ? '#ef4444' : '#10b981' }}>{importMsg}</span>}
                    <button className="cfg-btn cfg-btn-outline" onClick={handleCsvImport}>
                        <Upload size={14} /> Bulk CSV Import
                    </button>
                    <button className="cfg-btn cfg-btn-primary" onClick={openAdd}>
                        <Plus size={14} /> Add Sensor
                    </button>
                </div>
            </div>

            <div className="cfg-table-wrap">
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
                ) : (
                    <table className="cfg-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>NAME</th>
                                <th>NETWORK</th>
                                <th>STATE / DIST</th>
                                <th>ZONE / WARD</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sensors.map((s) => (
                                <tr key={s.id}>
                                    <td className="cfg-cell-id">{s.displayId}</td>
                                    <td className="cfg-cell-name">{s.name}</td>
                                    <td><NetworkBadge network={s.network} /></td>
                                    <td>{s.state} / {s.district}</td>
                                    <td>{s.zone || 'N/A'} / Ward {s.ward || 'N/A'}</td>
                                    <td><StatusBadge status={s.status} /></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="cfg-icon-btn" title="Edit" onClick={() => openEdit(s)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className="cfg-icon-btn danger"
                                                title="Delete"
                                                onClick={() => setDeleteConfirm(s.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {sensors.length === 0 && (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sensors found</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="cfg-pagination">
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {pagination.totalPages}</span>
                    <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="dss-modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="dss-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                        <div className="dss-modal-header">
                            <h3>{editingSensor ? 'Edit Sensor' : 'Add New Sensor'}</h3>
                            <button className="dss-modal-close" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                        </div>
                        <div className="dss-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {formError && <div style={{ color: '#ef4444', fontSize: '0.82rem' }}>{formError}</div>}
                            <div className="cfg-form-row">
                                <label>Sensor ID *</label>
                                <input
                                    type="text"
                                    value={form.id}
                                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                                    disabled={!!editingSensor}
                                    placeholder="e.g. caaqms_gomti_nagar"
                                />
                            </div>
                            <div className="cfg-form-row">
                                <label>Name</label>
                                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Gomti Nagar CAAQMS" />
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="cfg-form-row" style={{ flex: 1 }}>
                                    <label>Latitude *</label>
                                    <input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
                                </div>
                                <div className="cfg-form-row" style={{ flex: 1 }}>
                                    <label>Longitude *</label>
                                    <input type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
                                </div>
                            </div>
                            <div className="cfg-form-row">
                                <label>Device Type</label>
                                <select value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="caaqms">CAAQMS</option>
                                    <option value="atmos">Low-cost PM2.5 (Atmos)</option>
                                    <option value="aurassure">AWS (Aurassure)</option>
                                    <option value="airveda">Low-cost PM2.5 (Airveda)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="cfg-form-row" style={{ flex: 1 }}>
                                    <label>Ward Number</label>
                                    <input type="number" value={form.wardNumber} onChange={(e) => setForm({ ...form, wardNumber: e.target.value })} />
                                </div>
                                <div className="cfg-form-row" style={{ flex: 1 }}>
                                    <label>Zone ID</label>
                                    <input type="number" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="dss-modal-footer">
                            <button className="dss-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="dss-btn dss-btn-success" onClick={handleSubmit} disabled={formLoading}>
                                {formLoading ? 'Saving...' : editingSensor ? 'Update Sensor' : 'Create Sensor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="dss-modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="dss-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
                        <div className="dss-modal-header">
                            <h3>Delete Sensor</h3>
                            <button className="dss-modal-close" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
                        </div>
                        <div className="dss-modal-body">
                            <p>Are you sure you want to delete sensor <strong>{deleteConfirm}</strong>? This action cannot be undone.</p>
                        </div>
                        <div className="dss-modal-footer">
                            <button className="dss-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button className="dss-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={() => handleDelete(deleteConfirm)}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
