import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import { UploadCloud, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import {
    useSaveLeadSourceMappingMutation,
    useImportGoogleSheetMutation
} from '../../features/leads/leadApi';

export default function GoogleSheetSetup({ 
    spreadsheets, 
    worksheets, 
    onSelectSpreadsheet,
    selectedSpreadsheetId,
    onSelectWorksheet,
    selectedWorksheetId,
    previewData,
    loadingSpreadsheets, 
    loadingWorksheets,
    loadingPreview,
    activeMapping,
    customFields,
    connectionId
}) {
    const toast = useToast();
    const [saveMapping, { isLoading: saving }] = useSaveLeadSourceMappingMutation();
    const [importSheet, { isLoading: importing }] = useImportGoogleSheetMutation();

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
        if (!selectedSpreadsheetId || !selectedWorksheetId) return toast('Please select a spreadsheet and worksheet', 'error');
        try {
            await saveMapping({
                connectionId,
                source: 'google_sheets',
                provider: 'google_sheets',
                externalSpreadsheetId: selectedSpreadsheetId,
                externalWorksheetId: selectedWorksheetId,
                fieldMapping,
                customFieldMapping: customMapping,
                duplicateHandling: leadConfig.duplicateHandling,
                defaultAssignedTo: leadConfig.defaultAssignedTo || null,
                isActive: true
            }).unwrap();
            toast('Sheet mapping saved', 'success');
        } catch (err) {
            toast(err.data?.message || 'Failed to save mapping', 'error');
        }
    };

    const handleImport = async () => {
        if (!activeMapping) return toast('Save mapping first', 'error');
        try {
            await importSheet({
                spreadsheetId: selectedSpreadsheetId,
                worksheetName: selectedWorksheetId,
                mappingId: activeMapping._id
            }).unwrap();
            toast('Import queued successfully. Processing in background.', 'success');
        } catch (err) {
            toast(err.data?.message || 'Failed to queue import', 'error');
        }
    };

    if (!spreadsheets || spreadsheets.length === 0) {
        return (
            <div className="p-4 text-center text-sm text-[var(--vz-text-muted)]">
                {loadingSpreadsheets ? 'Loading spreadsheets...' : 'No Google Sheets found.'}
            </div>
        );
    }

    const headers = previewData?.headers || [];
    const sampleRows = previewData?.sampleRows || [];
    const hasMapping = !!activeMapping;

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <h3 className="text-lg font-medium text-[var(--vz-heading)] mb-4">Select Google Sheet</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--vz-text-muted)] mb-1">Spreadsheet</label>
                        <Select
                            value={selectedSpreadsheetId}
                            onChange={(val) => onSelectSpreadsheet(val)}
                            options={[
                                { label: 'Select a spreadsheet...', value: '' },
                                ...spreadsheets.map(s => ({ label: s.name, value: s.id }))
                            ]}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--vz-text-muted)] mb-1">Worksheet</label>
                        <Select
                            value={selectedWorksheetId}
                            onChange={(val) => onSelectWorksheet(val)}
                            options={[
                                { label: 'Select a worksheet...', value: '' },
                                ...(worksheets || []).map(w => ({ label: w.name, value: w.name })) // Use name instead of ID since sheets API uses ranges like 'Sheet1!A1'
                            ]}
                            disabled={!selectedSpreadsheetId || loadingWorksheets}
                        />
                    </div>
                </div>
            </Card>

            {loadingPreview && <div className="text-sm text-[var(--vz-text-muted)]">Loading preview...</div>}

            {selectedWorksheetId && headers.length > 0 && (
                <Card className="p-6 overflow-x-auto">
                    <h3 className="text-lg font-medium text-[var(--vz-heading)] mb-4 flex items-center">
                        <Eye size={18} className="mr-2" /> Data Preview (First 10 rows)
                    </h3>
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-[var(--vz-text-muted)] uppercase bg-[var(--vz-body-bg)]">
                            <tr>
                                {headers.map((h, i) => <th key={i} className="px-4 py-2">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {sampleRows.map((row, i) => (
                                <tr key={i} className="border-b border-[var(--vz-border)] hover:bg-[var(--vz-body-bg)]">
                                    {headers.map((_, j) => <td key={j} className="px-4 py-2">{row[j] || ''}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {selectedWorksheetId && headers.length > 0 && (
                <Card className="p-6">
                    <h3 className="text-lg font-medium text-[var(--vz-heading)] mb-4">Field Mapping</h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 pb-2 border-b border-[var(--vz-border)] font-medium text-sm text-[var(--vz-text-muted)]">
                            <div>SparkCRM Field</div>
                            <div>Google Sheet Column</div>
                        </div>
                        
                        {standardCRMFields.map(crmField => (
                            <div key={crmField.value} className="grid grid-cols-2 gap-4 items-center">
                                <div className="text-sm">{crmField.label}</div>
                                <Select
                                    value={fieldMapping[crmField.value] || ''}
                                    onChange={(val) => setFieldMapping(prev => ({ ...prev, [crmField.value]: val }))}
                                    options={[
                                        { label: '-- Ignore --', value: '' },
                                        ...headers.map(h => ({ label: h, value: h }))
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
                                                ...headers.map(h => ({ label: h, value: h }))
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

                    <div className="mt-6 flex justify-end gap-3">
                        <Button onClick={handleSaveMapping} loading={saving}>
                            Save Mapping
                        </Button>
                        {hasMapping && (
                            <Button onClick={handleImport} loading={importing}>
                                <UploadCloud size={16} className="mr-2" />
                                Import Now
                            </Button>
                        )}
                    </div>
                    
                    {hasMapping && activeMapping.meta?.importStatus && (
                        <div className="mt-4 p-4 bg-[var(--vz-body-bg)] rounded-lg text-sm flex items-center justify-between">
                            <div>
                                <span className="font-medium text-[var(--vz-heading)]">Last Import Status: </span>
                                <Badge variant={
                                    activeMapping.meta.importStatus === 'completed' ? 'success' : 
                                    activeMapping.meta.importStatus === 'failed' ? 'danger' : 'warning'
                                }>
                                    {activeMapping.meta.importStatus}
                                </Badge>
                            </div>
                            <div className="text-xs text-[var(--vz-text-muted)]">
                                {activeMapping.lastSyncedAt ? new Date(activeMapping.lastSyncedAt).toLocaleString() : ''}
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
