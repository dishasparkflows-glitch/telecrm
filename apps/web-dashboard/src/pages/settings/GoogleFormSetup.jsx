import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import { RefreshCw, Play, Pause, Save, CheckCircle2, TestTube2, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import {
    useActivateGoogleFormMutation,
    usePauseGoogleFormMutation,
    useSyncGoogleFormMutation,
    useTestGoogleFormMutation,
    useSaveLeadSourceMappingMutation
} from '../../features/leads/leadApi';

export default function GoogleFormSetup({ 
    forms, 
    fields, 
    onSelectForm, 
    selectedFormId, 
    loadingForms, 
    loadingFields,
    activeMapping,
    customFields,
    connectionId
}) {
    const toast = useToast();
    const [activateForm, { isLoading: activating }] = useActivateGoogleFormMutation();
    const [pauseForm, { isLoading: pausing }] = usePauseGoogleFormMutation();
    const [syncForm, { isLoading: syncing }] = useSyncGoogleFormMutation();
    const [testForm, { isLoading: testing }] = useTestGoogleFormMutation();
    const [saveMapping, { isLoading: saving }] = useSaveLeadSourceMappingMutation();

    const [fieldMapping, setFieldMapping] = useState(activeMapping?.fieldMapping || {
        firstName: '', lastName: '', email: '', phone: ''
    });
    const [customMapping, setCustomMapping] = useState(activeMapping?.customFieldMapping || {});
    const [leadConfig, setLeadConfig] = useState({
        duplicateHandling: activeMapping?.duplicateHandling || 'update',
        defaultAssignedTo: activeMapping?.defaultAssignedTo || ''
    });

    const standardCRMFields = [
        { label: 'First Name', value: 'firstName' },
        { label: 'Last Name', value: 'lastName' },
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
        { label: 'Company', value: 'company' }
    ];

    const leadCustomFields = customFields?.filter(f => f.entity === 'Lead') || [];

    const handleSaveMapping = async () => {
        if (!selectedFormId) return toast('Please select a form first', 'error');
        try {
            await saveMapping({
                connectionId,
                source: 'google_forms',
                provider: 'google_forms',
                externalFormId: selectedFormId,
                externalFormName: forms.find(f => f.id === selectedFormId)?.name || selectedFormId,
                fieldMapping,
                customFieldMapping: customMapping,
                duplicateHandling: leadConfig.duplicateHandling,
                defaultAssignedTo: leadConfig.defaultAssignedTo || null,
                isActive: activeMapping ? activeMapping.isActive : true
            }).unwrap();
            toast('Form mapping saved', 'success');
        } catch (err) {
            toast(err.data?.message || 'Failed to save mapping', 'error');
        }
    };

    const handleTest = async () => {
        if (!selectedFormId) return;
        try {
            await testForm(selectedFormId).unwrap();
            toast('Test connection successful', 'success');
        } catch (err) {
            toast('Test connection failed', 'error');
        }
    };

    const handleActivate = async () => {
        if (!selectedFormId) return;
        try {
            await activateForm(selectedFormId).unwrap();
            toast('Form activated and listening for responses', 'success');
        } catch (err) {
            toast(err.data?.message || 'Failed to activate form', 'error');
        }
    };

    const handlePause = async () => {
        if (!selectedFormId) return;
        try {
            await pauseForm(selectedFormId).unwrap();
            toast('Form paused', 'success');
        } catch (err) {
            toast('Failed to pause form', 'error');
        }
    };

    const handleSync = async () => {
        if (!selectedFormId) return;
        try {
            const res = await syncForm(selectedFormId).unwrap();
            toast(`Synced successfully. Created ${res.data.created} leads.`, 'success');
        } catch (err) {
            toast('Failed to sync form', 'error');
        }
    };

    if (!forms || forms.length === 0) {
        return (
            <div className="p-4 text-center text-sm text-[var(--vz-text-muted)]">
                {loadingForms ? 'Loading forms...' : 'No Google Forms found in your account.'}
            </div>
        );
    }

    const isActive = activeMapping?.isActive;
    const hasMapping = !!activeMapping;

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-[var(--vz-heading)]">Select a Google Form</h3>
                    {hasMapping && (
                        <Badge variant={isActive ? 'success' : 'warning'}>
                            {isActive ? 'Active' : 'Paused'}
                        </Badge>
                    )}
                </div>
                <Select
                    value={selectedFormId}
                    onChange={(val) => onSelectForm(val)}
                    options={[
                        { label: 'Select a form...', value: '' },
                        ...forms.map(f => ({ label: f.name, value: f.id }))
                    ]}
                />
            </Card>

            {selectedFormId && fields && (
                <Card className="p-6">
                    <h3 className="text-lg font-medium text-[var(--vz-heading)] mb-4">Field Mapping</h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 pb-2 border-b border-[var(--vz-border)] font-medium text-sm text-[var(--vz-text-muted)]">
                            <div>SparkCRM Field</div>
                            <div>Google Form Question</div>
                        </div>
                        
                        {standardCRMFields.map(crmField => (
                            <div key={crmField.value} className="grid grid-cols-2 gap-4 items-center">
                                <div className="text-sm">{crmField.label}</div>
                                <Select
                                    value={fieldMapping[crmField.value] || ''}
                                    onChange={(val) => setFieldMapping(prev => ({ ...prev, [crmField.value]: val }))}
                                    options={[
                                        { label: '-- Ignore --', value: '' },
                                        ...fields.map(f => ({ label: f.name, value: f.id }))
                                    ]}
                                />
                            </div>
                        ))}

                        {leadCustomFields.length > 0 && (
                            <>
                                <div className="pt-4 pb-2 border-b border-[var(--vz-border)] font-medium text-sm text-[var(--vz-text-muted)]">
                                    Custom Fields
                                </div>
                                {leadCustomFields.map(customField => (
                                    <div key={customField.name} className="grid grid-cols-2 gap-4 items-center">
                                        <div className="text-sm">{customField.label}</div>
                                        <Select
                                            value={customMapping[customField.name] || ''}
                                            onChange={(val) => setCustomMapping(prev => ({ ...prev, [customField.name]: val }))}
                                            options={[
                                                { label: '-- Ignore --', value: '' },
                                                ...fields.map(f => ({ label: f.name, value: f.id }))
                                            ]}
                                        />
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                    
                    <div className="mt-8 space-y-4">
                        <h4 className="text-md font-medium text-[var(--vz-heading)]">Lead Configuration</h4>
                        <div className="grid grid-cols-2 gap-4 items-center">
                            <div className="text-sm">Duplicate Handling</div>
                            <Select
                                value={leadConfig.duplicateHandling}
                                onChange={(val) => setLeadConfig(prev => ({ ...prev, duplicateHandling: val }))}
                                options={[
                                    { label: 'Update Existing Lead', value: 'update' },
                                    { label: 'Create Always', value: 'create' },
                                    { label: 'Ignore Duplicate', value: 'ignore' }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleSaveMapping} loading={saving}>
                            <Save size={16} className="mr-2" />
                            Save Mapping
                        </Button>
                    </div>
                </Card>
            )}

            {hasMapping && (
                <Card className="p-6">
                    <h3 className="text-lg font-medium text-[var(--vz-heading)] mb-4">Integration Actions</h3>
                    
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={handleTest} loading={testing}>
                            <TestTube2 size={16} className="mr-2" />
                            Test Connection
                        </Button>

                        {!isActive ? (
                            <Button onClick={handleActivate} loading={activating}>
                                <Play size={16} className="mr-2" />
                                Activate
                            </Button>
                        ) : (
                            <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={handlePause} loading={pausing}>
                                <Pause size={16} className="mr-2" />
                                Pause
                            </Button>
                        )}

                        {isActive && (
                            <Button variant="outline" onClick={handleSync} loading={syncing}>
                                <RefreshCw size={16} className="mr-2" />
                                Sync Now
                            </Button>
                        )}
                    </div>
                    
                    <div className="mt-4 text-xs text-[var(--vz-text-muted)] flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-green-500" />
                        Last Synced: {activeMapping.lastSyncedAt ? new Date(activeMapping.lastSyncedAt).toLocaleString() : 'Never'}
                    </div>
                </Card>
            )}
        </div>
    );
}

console.log("GoogleFormSetup rendered");
