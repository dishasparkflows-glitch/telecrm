import React, { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Plus, Trash2, GripVertical, MousePointer2, CheckCircle2, Settings2 } from 'lucide-react'

const FieldRow = ({ field, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const needsOptions = ['dropdown', 'radio', 'multiselect'].includes(field.type);

  return (
    <div className="flex flex-col p-3 bg-[var(--vz-body-bg)] rounded-lg border border-[var(--vz-border)] mb-3">
      <div className="flex items-center gap-3 group">
        <div className="text-[var(--vz-text-muted)] cursor-grab">
          <GripVertical size={16} />
        </div>
        <div className="flex-1 grid grid-cols-12 gap-2">
          <div className="col-span-3">
            <Input
              placeholder="Field Label"
              value={field.label || ''}
              onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            />
          </div>
          <div className="col-span-3">
            <Select
              value={field.type || 'text'}
              onChange={(val) => onUpdate({ ...field, type: val })}
              options={[
                { value: 'text', label: 'Short Text' },
                { value: 'textarea', label: 'Long Text' },
                { value: 'email', label: 'Email' },
                { value: 'phone', label: 'Phone' },
                { value: 'number', label: 'Number' },
                { value: 'currency', label: 'Currency' },
                { value: 'date', label: 'Date' },
                { value: 'datetime', label: 'Date & Time' },
                { value: 'dropdown', label: 'Dropdown' },
                { value: 'radio', label: 'Radio Buttons' },
                { value: 'checkbox', label: 'Single Checkbox' },
                { value: 'multiselect', label: 'Multi-Select' },
              ]}
            />
          </div>
          <div className="col-span-3">
            <Input
              placeholder="Name attribute"
              value={field.name || ''}
              onChange={(e) => onUpdate({ ...field, name: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex justify-center">
            <label className="flex items-center gap-1 text-[10px] text-gray-500">
              <input 
                type="checkbox" 
                checked={field.required || false} 
                onChange={(e) => onUpdate({ ...field, required: e.target.checked })} 
                className="accent-primary"
              /> Req
            </label>
          </div>
          <div className="col-span-1 flex items-center justify-end gap-1">
            <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-400 hover:text-primary transition-colors" title="Settings">
              <Settings2 size={14} />
            </button>
            <button onClick={onRemove} className="p-1 text-danger hover:bg-danger/10 rounded transition-all" title="Remove">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pl-8 pt-3 border-t border-[var(--vz-border)] grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-[var(--vz-text-muted)] uppercase mb-1">Help Text</label>
            <Input size="sm" value={field.helpText || ''} onChange={(e) => onUpdate({ ...field, helpText: e.target.value })} placeholder="Displayed below field" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--vz-text-muted)] uppercase mb-1">Default Value</label>
            <Input size="sm" value={field.defaultValue || ''} onChange={(e) => onUpdate({ ...field, defaultValue: e.target.value })} placeholder="Pre-filled value" />
          </div>
          {needsOptions && (
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[var(--vz-text-muted)] uppercase mb-1">Options (Comma separated)</label>
              <Input size="sm" value={(field.options || []).join(', ')} onChange={(e) => onUpdate({ ...field, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Option 1, Option 2" />
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-[var(--vz-text-muted)] uppercase mb-1">Conditional Logic (Show if)</label>
            <div className="flex gap-2 items-center">
              <Input size="sm" value={field.showIf?.field || ''} onChange={(e) => onUpdate({ ...field, showIf: { ...field.showIf, field: e.target.value } })} placeholder="Depends on Field Name" className="flex-1" />
              <Select size="sm" value={field.showIf?.operator || 'equals'} onChange={(val) => onUpdate({ ...field, showIf: { ...field.showIf, operator: val } })} options={[{value:'equals',label:'Equals'}, {value:'not_equals',label:'Not Equals'}, {value:'contains',label:'Contains'}]} className="w-1/4" />
              <Input size="sm" value={field.showIf?.value || ''} onChange={(e) => onUpdate({ ...field, showIf: { ...field.showIf, value: e.target.value } })} placeholder="Value" className="flex-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FormBuilderModal({ editingForm, setEditingForm, handleSaveFields, updating }) {
  const [activeTab, setActiveTab] = useState('BUILDER');

  const addField = () => {
    const newField = { label: '', name: '', type: 'text', required: false, options: [], helpText: '', defaultValue: '' }
    setEditingForm({ ...editingForm, fields: [...(editingForm.fields || []), newField] })
  }

  const tabs = [
    { id: 'BUILDER', label: 'Form Builder' },
    { id: 'SETTINGS', label: 'Settings' },
    { id: 'LEAD', label: 'Lead Settings' },
    { id: 'AUTOMATION', label: 'After Submit' }
  ];

  return (
    <Modal isOpen onClose={() => setEditingForm(null)} title={`Edit Form: ${editingForm.name}`} size="xl">
      <div className="border-b border-[var(--vz-border)] mb-4 flex gap-4 px-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 px-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6 min-h-[400px]">
        {activeTab === 'BUILDER' && (
          <div>
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h6 className="text-sm font-bold text-[var(--vz-heading)]">Define Form Schema</h6>
                  <p className="text-[11px] text-[var(--vz-text-muted)]">Add the fields you want to collect</p>
               </div>
               <Button size="sm" variant="soft-primary" onClick={addField}>
                 <Plus size={14} /> Add Field
               </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {editingForm.fields?.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[var(--vz-border)] rounded-xl">
                   <MousePointer2 size={32} className="mx-auto text-[var(--vz-text-muted)] mb-3 opacity-30" />
                   <p className="text-sm text-[var(--vz-text-muted)]">No fields added yet. Click 'Add Field' to start.</p>
                </div>
              ) : (
                editingForm.fields.map((field, i) => (
                  <FieldRow 
                    key={i} 
                    field={field} 
                    onUpdate={(updated) => {
                      const newFields = [...editingForm.fields]
                      newFields[i] = updated
                      setEditingForm({ ...editingForm, fields: newFields })
                    }}
                    onRemove={() => {
                      const newFields = editingForm.fields.filter((_, idx) => idx !== i)
                      setEditingForm({ ...editingForm, fields: newFields })
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
             <Input label="Form Name" value={editingForm.name || ''} onChange={e => setEditingForm({...editingForm, name: e.target.value})} />
             <Input label="Description" value={editingForm.description || ''} onChange={e => setEditingForm({...editingForm, description: e.target.value})} />
             <div className="grid grid-cols-2 gap-4">
                <Select label="Theme" value={editingForm.styling?.theme || 'light'} onChange={v => setEditingForm({...editingForm, styling: {...editingForm.styling, theme: v}})} options={[{value:'light',label:'Light'}, {value:'dark',label:'Dark'}]} />
                <Input type="color" label="Primary Color" value={editingForm.styling?.primaryColor || '#4f46e5'} onChange={e => setEditingForm({...editingForm, styling: {...editingForm.styling, primaryColor: e.target.value}})} />
             </div>
             <label className="flex items-center gap-2 text-sm font-bold text-[var(--vz-heading)] mt-4">
                <input type="checkbox" checked={editingForm.isActive} onChange={(e) => setEditingForm({...editingForm, isActive: e.target.checked})} className="rounded text-primary" />
                Active (Accepting Submissions)
             </label>
          </div>
        )}

        {activeTab === 'LEAD' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
               <label className="flex items-center gap-2 text-sm font-bold text-[var(--vz-heading)]">
                  <input type="checkbox" checked={editingForm.settings?.createLead !== false} onChange={(e) => setEditingForm({...editingForm, settings: {...editingForm.settings, createLead: e.target.checked}})} className="rounded text-primary" />
                  Auto-create Lead on Submission
               </label>
            </div>
            
            {editingForm.settings?.createLead !== false && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Lead Source" value={editingForm.settings?.leadSource || 'smart_form'} onChange={e => setEditingForm({...editingForm, settings: {...editingForm.settings, leadSource: e.target.value}})} />
                  <Select label="Initial Stage" value={editingForm.settings?.leadStage || 'new'} onChange={v => setEditingForm({...editingForm, settings: {...editingForm.settings, leadStage: v}})} options={[{value:'new',label:'New Lead'}, {value:'contacted',label:'Contacted'}]} />
                  <Input label="Auto Tags (Comma separated)" value={(editingForm.settings?.autoTag || []).join(', ')} onChange={e => setEditingForm({...editingForm, settings: {...editingForm.settings, autoTag: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}})} />
                </div>

                <div className="mt-6 border p-4 rounded-xl">
                  <h6 className="text-sm font-bold mb-3">CRM Field Mapping</h6>
                  <p className="text-xs text-gray-500 mb-4">Map your form fields to CRM Lead fields.</p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {editingForm.fields?.map((f, i) => (
                      <div key={i} className="flex gap-4 items-center">
                        <span className="w-1/3 text-xs font-semibold">{f.label || f.name}</span>
                        <Select 
                          className="flex-1 text-xs" 
                          value={f.crmField || ''} 
                          onChange={v => {
                            const newFields = [...editingForm.fields];
                            newFields[i].crmField = v;
                            setEditingForm({...editingForm, fields: newFields});
                          }}
                          options={[
                            {value:'', label:'-- Do Not Map --'},
                            {value:'firstName', label:'First Name'},
                            {value:'lastName', label:'Last Name'},
                            {value:'email', label:'Email'},
                            {value:'phone', label:'Phone'},
                            {value:'company', label:'Company'},
                            {value:'designation', label:'Designation'},
                            {value:'contact.city', label:'City'},
                            {value:'customFields.budget', label:'Budget (Custom)'},
                            {value:'customFields.notes', label:'Notes (Custom)'},
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'AUTOMATION' && (
          <div className="space-y-4">
             <Select 
               label="After Submit Action" 
               value={editingForm.settings?.afterSubmitAction || 'message'} 
               onChange={v => setEditingForm({...editingForm, settings: {...editingForm.settings, afterSubmitAction: v}})}
               options={[
                 {value:'message', label:'Show Success Message'},
                 {value:'redirect', label:'Redirect to URL'},
                 {value:'booking', label:'Redirect to Booking Link'}
               ]}
             />
             
             {(!editingForm.settings?.afterSubmitAction || editingForm.settings?.afterSubmitAction === 'message') && (
               <Input label="Success Message" value={editingForm.settings?.successMessage || ''} onChange={e => setEditingForm({...editingForm, settings: {...editingForm.settings, successMessage: e.target.value}})} />
             )}

             {editingForm.settings?.afterSubmitAction === 'redirect' && (
               <Input label="Redirect URL" placeholder="https://..." value={editingForm.settings?.redirectUrl || ''} onChange={e => setEditingForm({...editingForm, settings: {...editingForm.settings, redirectUrl: e.target.value}})} />
             )}

             {editingForm.settings?.afterSubmitAction === 'booking' && (
               <Input label="Booking Link ID" placeholder="Paste your calendar link ID" value={editingForm.settings?.bookingLinkId || ''} onChange={e => setEditingForm({...editingForm, settings: {...editingForm.settings, bookingLinkId: e.target.value}})} />
             )}

             <Input label="Submit Button Text" value={editingForm.settings?.submitButtonText || 'Submit'} onChange={e => setEditingForm({...editingForm, settings: {...editingForm.settings, submitButtonText: e.target.value}})} />
          </div>
        )}

      </div>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={() => setEditingForm(null)}>Discard Changes</Button>
        <Button size="sm" onClick={handleSaveFields} disabled={updating}>
          {updating ? 'Saving Schema...' : 'Save & Publish'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
