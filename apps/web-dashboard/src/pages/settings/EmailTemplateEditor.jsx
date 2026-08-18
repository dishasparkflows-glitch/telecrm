import React, { useState, useRef } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import { ArrowLeft, Save, Play } from 'lucide-react';
import {
    useCreateEmailTemplateMutation,
    useUpdateEmailTemplateMutation,
    usePreviewEmailTemplateMutation
} from '../../features/automations/emailTemplateApi';
import { useGetCustomFieldsQuery } from '../../features/custom-fields/customFieldApi';

export default function EmailTemplateEditor({ template, onClose }) {
    const toast = useToast();
    const [createTemplate, { isLoading: isCreating }] = useCreateEmailTemplateMutation();
    const [updateTemplate, { isLoading: isUpdating }] = useUpdateEmailTemplateMutation();
    const [previewTemplate, { isLoading: isPreviewing }] = usePreviewEmailTemplateMutation();

    const { data: customFieldsResp } = useGetCustomFieldsQuery();
    const customFields = customFieldsResp?.data || [];

    const [form, setForm] = useState({
        name: template?.name || '',
        description: template?.description || '',
        module: template?.module || 'Lead',
        subject: template?.subject || '',
        bodyHtml: template?.bodyHtml || '',
        bodyText: template?.bodyText || '',
        status: template?.status || 'draft'
    });

    const [previewHtml, setPreviewHtml] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    
    // Create a textarea ref to insert fields
    const bodyHtmlRef = useRef(null);
    const subjectRef = useRef(null);
    const [lastFocusedInput, setLastFocusedInput] = useState('bodyHtml'); // 'subject' or 'bodyHtml'

    const handleSave = async () => {
        if (!form.name || !form.subject || !form.bodyHtml) {
            return toast('Name, Subject, and HTML Body are required', 'error');
        }

        try {
            if (template) {
                await updateTemplate({ id: template._id, ...form }).unwrap();
                toast('Template updated successfully', 'success');
            } else {
                await createTemplate(form).unwrap();
                toast('Template created successfully', 'success');
            }
            onClose();
        } catch (err) {
            toast(err.data?.message || 'Failed to save template', 'error');
        }
    };

    const handlePreview = async () => {
        if (!template) {
            return toast('Please save the template first before previewing', 'error');
        }
        try {
            const res = await previewTemplate(template._id).unwrap();
            setPreviewHtml(res.data?.bodyHtml || '');
            setShowPreview(true);
        } catch (err) {
            toast(err.data?.message || 'Failed to generate preview', 'error');
        }
    };

    const insertVariable = (variable) => {
        const textToInsert = `{{${variable}}}`;
        const inputName = lastFocusedInput;
        const ref = inputName === 'subject' ? subjectRef : bodyHtmlRef;
        const currentValue = form[inputName];

        if (ref.current) {
            const startPos = ref.current.selectionStart || currentValue.length;
            const endPos = ref.current.selectionEnd || currentValue.length;

            const newValue = currentValue.substring(0, startPos) + textToInsert + currentValue.substring(endPos, currentValue.length);
            setForm((prev) => ({ ...prev, [inputName]: newValue }));

            // refocus
            setTimeout(() => {
                ref.current.focus();
                ref.current.setSelectionRange(startPos + textToInsert.length, startPos + textToInsert.length);
            }, 0);
        } else {
            setForm((prev) => ({ ...prev, [inputName]: prev[inputName] + textToInsert }));
        }
    };

    const standardFields = {
        Lead: [
            { key: 'lead.firstName', label: 'First Name' },
            { key: 'lead.lastName', label: 'Last Name' },
            { key: 'lead.email', label: 'Email' },
            { key: 'lead.phone', label: 'Phone' },
            { key: 'lead.source', label: 'Source' },
            { key: 'lead.stage', label: 'Stage' },
            { key: 'lead.status', label: 'Status' }
        ],
        User: [
            { key: 'user.name', label: 'Name' },
            { key: 'user.email', label: 'Email' },
            { key: 'user.phone', label: 'Phone' }
        ],
        Branch: [
            { key: 'branch.name', label: 'Name' }
        ],
        Company: [
            { key: 'company.name', label: 'Name' }
        ]
    };

    const getAvailableFields = () => {
        const fields = [];
        
        // Always include basic fields for selected module + global fields
        if (form.module === 'Lead') fields.push({ category: 'Lead', items: standardFields.Lead });
        fields.push({ category: 'Assigned User', items: standardFields.User });
        fields.push({ category: 'Branch', items: standardFields.Branch });
        fields.push({ category: 'Company', items: standardFields.Company });

        // Add custom fields
        const leadCustoms = customFields.filter(f => f.entity === 'Lead');
        if (form.module === 'Lead' && leadCustoms.length > 0) {
            fields.push({
                category: 'Lead Custom Fields',
                items: leadCustoms.map(f => ({ key: `lead.customFields.${f.name}`, label: f.label }))
            });
        }
        
        return fields;
    };

    return (
        <Card>
            <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-1.5 rounded bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <Card.Title>{template ? 'Edit Email Template' : 'Create Email Template'}</Card.Title>
                        <p className="text-xs text-[var(--vz-text-muted)]">Design the content and variables</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {template && (
                        <Button variant="outline" size="sm" onClick={handlePreview} disabled={isPreviewing}>
                            <Play size={14} className="mr-1.5" /> Preview
                        </Button>
                    )}
                    <Button size="sm" onClick={handleSave} disabled={isCreating || isUpdating}>
                        <Save size={14} className="mr-1.5" /> Save Template
                    </Button>
                </div>
            </Card.Header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-1">
                <div className="lg:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Template Name" placeholder="e.g. New Lead Welcome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-[var(--vz-heading)]">Module</label>
                            <Select
                                value={form.module}
                                onChange={(val) => setForm({ ...form, module: val })}
                                disabled={!!template}
                                options={[
                                    { value: 'Lead', label: 'Lead' }
                                ]}
                            />
                        </div>
                    </div>
                    
                    <Input label="Description (Optional)" placeholder="Short internal note about this template" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[var(--vz-heading)]">Subject</label>
                        <input
                            ref={subjectRef}
                            type="text"
                            value={form.subject}
                            onFocus={() => setLastFocusedInput('subject')}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-text)] focus:border-primary outline-none transition-colors"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[var(--vz-heading)]">HTML Body</label>
                        <textarea
                            ref={bodyHtmlRef}
                            rows={12}
                            value={form.bodyHtml}
                            onFocus={() => setLastFocusedInput('bodyHtml')}
                            onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-text)] focus:border-primary outline-none transition-colors font-mono text-sm"
                            placeholder="<h1>Welcome {{lead.firstName}}!</h1>"
                        />
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-[var(--vz-card-bg)] rounded-xl border border-[var(--vz-border)] overflow-hidden">
                        <div className="bg-[var(--vz-input-bg)] px-3 py-2 border-b border-[var(--vz-border)]">
                            <h6 className="text-xs font-bold uppercase tracking-wider text-[var(--vz-heading)]">Insert Variable</h6>
                            <p className="text-[10px] text-[var(--vz-text-muted)] mt-0.5">Click to insert at cursor</p>
                        </div>
                        <div className="p-2 max-h-[500px] overflow-y-auto space-y-4">
                            {getAvailableFields().map((group, i) => (
                                <div key={i} className="space-y-1">
                                    <h6 className="text-[11px] font-semibold text-[var(--vz-text-muted)] uppercase mb-1">{group.category}</h6>
                                    {group.items.map((field) => (
                                        <button
                                            key={field.key}
                                            onClick={() => insertVariable(field.key)}
                                            className="w-full text-left px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary text-xs text-[var(--vz-text)] transition-colors truncate"
                                        >
                                            {field.label}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                            <div>
                                <h3 className="font-bold text-gray-900">Email Preview</h3>
                                <p className="text-xs text-gray-500">Sample data is being used.</p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                                Close
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-white flex-1" dangerouslySetInnerHTML={{ __html: previewHtml || '<p>No content</p>' }} />
                    </div>
                </div>
            )}
        </Card>
    );
}
