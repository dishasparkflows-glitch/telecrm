import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Mail, Plus, Edit3, Trash2, Copy, Power } from 'lucide-react';
import EmailTemplateEditor from './EmailTemplateEditor';import {
    useGetEmailTemplatesQuery,
    useDeleteEmailTemplateMutation,
    useUpdateEmailTemplateStatusMutation,
    useDuplicateEmailTemplateMutation
} from '../../features/automations/emailTemplateApi';

export default function EmailTemplates() {
    const toast = useToast();
    const { data: templatesResp, isLoading } = useGetEmailTemplatesQuery();
    const templates = templatesResp?.data || [];

    const [deleteTemplate] = useDeleteEmailTemplateMutation();
    const [updateStatus] = useUpdateEmailTemplateStatusMutation();
    const [duplicateTemplate] = useDuplicateEmailTemplateMutation();

    const [editingTemplate, setEditingTemplate] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

    const handleDeleteClick = (id) => {
        setDeleteModal({ open: true, id });
    };

    const confirmDelete = async () => {
        try {
            await deleteTemplate(deleteModal.id).unwrap();
            toast('Template deleted successfully', 'success');
        } catch (err) {
            toast(err.data?.message || 'Failed to delete template', 'error');
        } finally {
            setDeleteModal({ open: false, id: null });
        }
    };

    const handleDuplicate = async (id) => {
        try {
            await duplicateTemplate(id).unwrap();
            toast('Template duplicated successfully', 'success');
        } catch (err) {
            toast(err.data?.message || 'Failed to duplicate template', 'error');
        }
    };

    const handleToggleStatus = async (template) => {
        const newStatus = template.status === 'active' ? 'inactive' : 'active';
        try {
            await updateStatus({ id: template._id, status: newStatus }).unwrap();
            toast(`Template marked as ${newStatus}`, 'success');
        } catch (err) {
            toast(err.data?.message || 'Failed to update status', 'error');
        }
    };

    if (isCreating || editingTemplate) {
        return (
            <EmailTemplateEditor
                template={editingTemplate}
                onClose={() => {
                    setEditingTemplate(null);
                    setIsCreating(false);
                }}
            />
        );
    }

    return (
        <Card>
            <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Card.Title>Email Templates</Card.Title>
                    <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">Manage dynamic templates used in automations</p>
                </div>
                <Button size="sm" onClick={() => setIsCreating(true)}>
                    <Plus size={14} className="mr-1.5" /> Create Template
                </Button>
            </Card.Header>

            {isLoading ? (
                <div className="py-20 text-center">
                    <span className="text-sm text-[var(--vz-text-muted)]">Loading templates...</span>
                </div>
            ) : templates.length === 0 ? (
                <EmptyState icon={Mail} title="No Email Templates" description="Create an email template to use in your automations." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <div key={template._id} className="flex flex-col p-6 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-sm hover:shadow-md transition-shadow h-full">
                            
                            <div className="flex items-start gap-3 mb-3">
                                <div className="mt-0.5 text-[var(--vz-text-muted)]">
                                    <Mail size={18} />
                                </div>
                                <div className="flex-1">
                                    <h6 className="text-base font-semibold text-[var(--vz-heading)] leading-tight mb-1 line-clamp-1" title={template.name}>
                                        {template.name}
                                    </h6>
                                    <p className="text-sm text-[var(--vz-text-muted)]">
                                        Module: <span className="font-medium text-[var(--vz-text)]">{template.module}</span>
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-[var(--vz-text-muted)] line-clamp-2 mb-5 flex-1">
                                {template.description || 'No description provided.'}
                            </p>

                            <div className="mb-6">
                                <Badge color={template.status === 'active' ? 'success' : template.status === 'inactive' ? 'danger' : 'warning'}>
                                    {template.status.toUpperCase()}
                                </Badge>
                            </div>

                            <div className="pt-4 border-t border-[var(--vz-border)] flex items-center justify-end gap-1">
                                <button
                                    onClick={() => handleToggleStatus(template)}
                                    className={`p-2 rounded-md transition-colors ${template.status === 'active' ? 'text-[var(--vz-text-muted)] hover:text-warning hover:bg-warning/10' : 'text-[var(--vz-text-muted)] hover:text-success hover:bg-success/10'}`}
                                    title={template.status === 'active' ? 'Deactivate' : 'Activate'}
                                >
                                    <Power size={16} />
                                </button>
                                <button onClick={() => setEditingTemplate(template)} className="p-2 text-[var(--vz-text-muted)] hover:text-primary transition-colors rounded-md hover:bg-primary/10" title="Edit">
                                    <Edit3 size={16} />
                                </button>
                                <button onClick={() => handleDuplicate(template._id)} className="p-2 text-[var(--vz-text-muted)] hover:text-primary transition-colors rounded-md hover:bg-primary/10" title="Duplicate">
                                    <Copy size={16} />
                                </button>
                                <button onClick={() => handleDeleteClick(template._id)} className="p-2 text-[var(--vz-text-muted)] hover:text-danger transition-colors rounded-md hover:bg-danger/10" title="Delete">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={deleteModal.open}
                title="Delete Email Template"
                message="Are you sure you want to delete this email template? This action cannot be undone and may affect automations currently using it."
                confirmText="Delete Template"
                variant="danger"
                isProcessing={false}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, id: null })}
            />
        </Card>
    );
}
