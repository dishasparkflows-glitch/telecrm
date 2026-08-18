import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetAllUsersListQuery } from '../../features/users/userApi';
import { useListRolesCompactQuery } from '../../features/roles/roleApi';
import { useGetCustomFieldsQuery } from '../../features/custom-fields/customFieldApi';
import { useCreateRuleMutation, useUpdateRuleMutation, useGetRulesQuery } from '../../features/automations/automationApi';
import { useGetEmailTemplatesQuery } from '../../features/automations/emailTemplateApi';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import { Zap, Clock, GitBranch, Play, Plus, Settings, ArrowLeft, Trash2, ChevronRight, X } from 'lucide-react';

const triggerLabels = {
    'lead.created': 'Lead Created', 'lead.stage_changed': 'Lead Stage Changed', 'lead.assigned': 'Lead Assigned',
    'form.submitted': 'Smart Form Submitted', 'call.completed': 'Call Completed', 'whatsapp.received': 'WhatsApp Received'
};

const actionLabels = {
    'assign_lead': 'Assign Lead', 'change_stage': 'Change Stage', 'change_status': 'Change Status',
    'add_tag': 'Add Tag', 'create_follow_up': 'Create Follow-up', 'send_email': 'Send Email',
    'send_whatsapp': 'Send WhatsApp', 'webhook': 'Send Webhook'
};

const operatorLabels = {
    equals: 'Equals', not_equals: 'Not Equals', contains: 'Contains', greater_than: 'Greater Than',
    less_than: 'Less Than', in: 'In List', is_empty: 'Is Empty', is_not_empty: 'Is Not Empty'
};

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function AutomationBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    // Queries
    const { data: usersData } = useGetAllUsersListQuery();
    const { data: rolesData } = useListRolesCompactQuery();
    const { data: customFieldsData } = useGetCustomFieldsQuery({ module: 'leads' });
    const { data: existingRules } = useGetRulesQuery({ limit: 100 }, { skip: !id });
    const { data: emailTemplatesResp } = useGetEmailTemplatesQuery();
    
    const [createRule, { isLoading: creating }] = useCreateRuleMutation();
    const [updateRule, { isLoading: updating }] = useUpdateRuleMutation();

    const users = usersData?.data || [];
    const roles = rolesData?.data || [];
    const customFields = customFieldsData?.data || [];
    const emailTemplates = emailTemplatesResp?.data || [];

    const standardLeadFields = [
        { value: 'source', label: 'Lead Source' },
        { value: 'status', label: 'Lead Status' },
        { value: 'score', label: 'Lead Score' },
        { value: 'email', label: 'Email Address' },
        { value: 'phone', label: 'Phone Number' },
        { value: 'firstName', label: 'First Name' },
        { value: 'lastName', label: 'Last Name' },
        { value: 'city', label: 'City' },
        { value: 'state', label: 'State' },
        { value: 'assignedTo', label: 'Assigned To' }
    ];

    const fieldOptions = [
        ...standardLeadFields,
        ...(customFields.map(f => ({ value: `customData.${f.key}`, label: `${f.label} (Custom)` })))
    ];

    // State
    const [name, setName] = useState('Untitled Automation');
    const [triggerEvent, setTriggerEvent] = useState('lead.created');
    const [triggerConditions, setTriggerConditions] = useState([]);
    
    // Nodes tree (recursive for branches)
    const [nodes, setNodes] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null); // 'trigger' or node object

    // Sidebar resize state
    const [sidebarWidth, setSidebarWidth] = useState(420);

    const handleMouseDown = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const handleMouseMove = (moveEvent) => {
            const deltaX = startX - moveEvent.clientX;
            const newWidth = Math.max(320, Math.min(800, startWidth + deltaX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    useEffect(() => {
        if (id && existingRules?.data) {
            const rule = existingRules.data.find(r => r._id === id);
            if (rule) {
                setName(rule.name);
                setTriggerEvent(rule.trigger.event);
                setTriggerConditions(rule.trigger.conditions || []);
                // Simple linear mapping for now (if they have branches, it gets complex to reconstruct)
                // For V1, we map flat actions to a flat node list.
                const mappedNodes = (rule.actions || []).map(act => ({
                    id: generateId(),
                    type: 'action',
                    actionType: act.type,
                    config: act.config || {},
                    delay: act.delay || 0,
                    conditions: act.conditions || []
                }));
                setNodes(mappedNodes);
            }
        }
    }, [id, existingRules]);

    const handleSave = async () => {
        if (!name.trim()) return toast('Please enter an automation name', 'error');

        // Compile tree to flat actions array
        const compiledActions = [];
        let currentDelay = 0;

        const traverse = (nodeList, inheritedConditions = []) => {
            for (const node of nodeList) {
                if (node.type === 'wait') {
                    currentDelay += Number(node.delayMinutes || 0);
                } else if (node.type === 'action') {
                    compiledActions.push({
                        type: node.actionType,
                        config: node.config,
                        delay: currentDelay,
                        conditions: [...inheritedConditions, ...(node.conditions || [])]
                    });
                } else if (node.type === 'branch') {
                    // Branch doesn't execute itself, it just splits logic
                    traverse(node.trueNodes || [], [...inheritedConditions, ...node.branchConditions]);
                    traverse(node.falseNodes || [], [...inheritedConditions, ...invertConditions(node.branchConditions)]);
                }
            }
        };

        traverse(nodes);

        const payload = {
            name,
            trigger: { event: triggerEvent, conditions: triggerConditions },
            actions: compiledActions
        };

        try {
            if (id) {
                await updateRule({ id, ...payload }).unwrap();
                toast('Automation updated', 'success');
            } else {
                await createRule(payload).unwrap();
                toast('Automation created', 'success');
                navigate('/automations');
            }
        } catch (err) {
            toast(err?.data?.message || 'Failed to save automation', 'error');
        }
    };

    const invertConditions = (conditions) => {
        // Simplified inversion for branch 'False' path
        return conditions.map(c => ({
            field: c.field,
            operator: c.operator === 'equals' ? 'not_equals' : c.operator === 'not_equals' ? 'equals' : 'not_equals', // simplified
            value: c.value
        }));
    };

    const addNode = (type, actionType = null) => {
        const newNode = {
            id: generateId(),
            type,
            ...(type === 'action' && { actionType, config: {}, conditions: [] }),
            ...(type === 'wait' && { delayMinutes: 60 }),
            ...(type === 'branch' && { branchConditions: [], trueNodes: [], falseNodes: [] })
        };
        setNodes([...nodes, newNode]);
        setSelectedNode(newNode);
    };

    const updateSelectedNode = (updates) => {
        if (!selectedNode || selectedNode === 'trigger') return;
        
        const updateTree = (list) => list.map(n => {
            if (n.id === selectedNode.id) return { ...n, ...updates };
            if (n.type === 'branch') {
                return { ...n, trueNodes: updateTree(n.trueNodes || []), falseNodes: updateTree(n.falseNodes || []) };
            }
            return n;
        });
        
        const updatedNodes = updateTree(nodes);
        setNodes(updatedNodes);
        
        // Also update the selected node reference so UI doesn't lag
        setSelectedNode({ ...selectedNode, ...updates });
    };

    const removeNode = (nodeId) => {
        const filterTree = (list) => list.filter(n => n.id !== nodeId).map(n => {
            if (n.type === 'branch') return { ...n, trueNodes: filterTree(n.trueNodes || []), falseNodes: filterTree(n.falseNodes || []) };
            return n;
        });
        setNodes(filterTree(nodes));
        if (selectedNode?.id === nodeId) setSelectedNode(null);
    };

    // --- RENDERERS ---

    const renderNodeTree = (nodeList) => {
        return nodeList.map((node, index) => (
            <div key={node.id} className="relative flex flex-col items-center">
                {/* Connector Line */}
                <div className="w-px h-6 bg-[var(--vz-border)]"></div>
                
                {/* Node Card */}
                <div 
                    onClick={() => setSelectedNode(node)}
                    className={`w-72 bg-[var(--vz-bg-secondary)] border rounded-lg p-3 cursor-pointer transition-all hover:border-primary shadow-sm flex items-center gap-3 ${selectedNode?.id === node.id ? 'border-primary ring-1 ring-primary/20' : 'border-[var(--vz-border)]'}`}
                >
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                        node.type === 'action' ? 'bg-primary/10 text-primary' : 
                        node.type === 'wait' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
                    }`}>
                        {node.type === 'action' ? <Play size={18} /> : node.type === 'wait' ? <Clock size={18} /> : <GitBranch size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-[var(--vz-heading)] truncate">
                            {node.type === 'action' ? actionLabels[node.actionType] : node.type === 'wait' ? `Wait ${node.delayMinutes} mins` : 'Condition Branch'}
                        </h4>
                        <p className="text-xs text-[var(--vz-text-muted)] truncate">
                            {node.type === 'action' ? 'Executes action' : node.type === 'wait' ? 'Pauses automation' : 'Splits workflow'}
                        </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeNode(node.id); }} className="text-[var(--vz-text-muted)] hover:text-danger p-1">
                        <Trash2 size={14} />
                    </button>
                </div>

                {/* Branch Paths */}
                {node.type === 'branch' && (
                    <div className="flex w-full mt-4 border-t border-[var(--vz-border)] pt-4 relative">
                        {/* True Path */}
                        <div className="flex-1 flex flex-col items-center border-r border-[var(--vz-border)] relative">
                            <span className="absolute -top-3 bg-[var(--vz-bg-secondary)] px-2 text-xs font-semibold text-success">TRUE</span>
                            {renderNodeTree(node.trueNodes || [])}
                            <div className="w-px h-6 bg-[var(--vz-border)] mt-2"></div>
                            <Button size="xs" variant="outline" onClick={() => {/* Handle add to branch - complex for V1, keeping it flat mostly */}}>+ Add</Button>
                        </div>
                        {/* False Path */}
                        <div className="flex-1 flex flex-col items-center relative">
                            <span className="absolute -top-3 bg-[var(--vz-bg-secondary)] px-2 text-xs font-semibold text-danger">FALSE</span>
                            {renderNodeTree(node.falseNodes || [])}
                            <div className="w-px h-6 bg-[var(--vz-border)] mt-2"></div>
                            <Button size="xs" variant="outline">+ Add</Button>
                        </div>
                    </div>
                )}
            </div>
        ));
    };

    const renderConfigPanel = () => {
        if (!selectedNode) return <div className="p-6 text-center text-[var(--vz-text-muted)] mt-20">Select a node to configure</div>;

        if (selectedNode === 'trigger') {
            return (
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--vz-heading)] flex items-center gap-2">
                            <Zap size={20} className="text-warning" /> Trigger Configuration
                        </h3>
                        <p className="text-sm text-[var(--vz-text-muted)]">When should this automation start?</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Event</label>
                        <Select value={triggerEvent} onChange={setTriggerEvent} options={Object.entries(triggerLabels).map(([k,v]) => ({value:k, label:v}))} />
                    </div>

                    <div className="pt-4 border-t border-[var(--vz-border)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">Trigger Conditions</h4>
                            <Button size="xs" variant="outline" onClick={() => setTriggerConditions([...triggerConditions, { field: 'source', operator: 'equals', value: '' }])}>+ Add Condition</Button>
                        </div>
                        {triggerConditions.map((cond, i) => (
                            <div key={i} className="flex gap-2 p-3 bg-[var(--vz-bg-secondary)] rounded border border-[var(--vz-border)]">
                                <div className="flex-1 space-y-2">
                                    <Select value={cond.field} onChange={val => {
                                        const newC = [...triggerConditions]; newC[i].field = val; setTriggerConditions(newC);
                                    }} options={fieldOptions} />
                                    <Select value={cond.operator} onChange={val => {
                                        const newC = [...triggerConditions]; newC[i].operator = val; setTriggerConditions(newC);
                                    }} options={Object.entries(operatorLabels).map(([k,v]) => ({value:k, label:v}))} />
                                    <Input placeholder="Value" value={cond.value} onChange={e => {
                                        const newC = [...triggerConditions]; newC[i].value = e.target.value; setTriggerConditions(newC);
                                    }} />
                                </div>
                                <button onClick={() => setTriggerConditions(triggerConditions.filter((_, idx) => idx !== i))} className="text-danger p-1"><X size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (selectedNode.type === 'action') {
            return (
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--vz-heading)] flex items-center gap-2">
                            <Play size={20} className="text-primary" /> Action Configuration
                        </h3>
                        <p className="text-sm text-[var(--vz-text-muted)]">{actionLabels[selectedNode.actionType]}</p>
                    </div>

                    {/* Dynamic Action Configs */}
                    {selectedNode.actionType === 'assign_lead' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Assign To User</label>
                                <Select 
                                    value={selectedNode.config.userId || ''} 
                                    onChange={v => updateSelectedNode({ config: { ...selectedNode.config, userId: v } })}
                                    options={[{value: '', label: 'Select User...'}, ...users.map(u => ({ value: u._id, label: u.name }))]}
                                />
                            </div>
                        </div>
                    )}
                    {selectedNode.actionType === 'change_stage' && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Pipeline Stage</label>
                            <Input placeholder="e.g. Qualified" value={selectedNode.config.stage || ''} onChange={e => updateSelectedNode({ config: { ...selectedNode.config, stage: e.target.value } })} />
                        </div>
                    )}
                    {selectedNode.actionType === 'add_tag' && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tag Name</label>
                            <Input placeholder="e.g. VIP" value={selectedNode.config.tag || ''} onChange={e => updateSelectedNode({ config: { ...selectedNode.config, tag: e.target.value } })} />
                        </div>
                    )}
                    {selectedNode.actionType === 'send_email' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Email Template</label>
                                <Select 
                                    value={selectedNode.config.templateId || ''}
                                    onChange={v => updateSelectedNode({ config: { ...selectedNode.config, templateId: v } })}
                                    options={[
                                        { value: '', label: 'Select an Email Template' },
                                        ...emailTemplates.filter(t => t.status === 'active').map(t => ({ value: t._id, label: t.name }))
                                    ]}
                                />
                                <p className="text-[11px] text-[var(--vz-text-muted)] mt-1">Select an active email template created in Settings.</p>
                            </div>
                        </div>
                    )}
                    {selectedNode.actionType === 'send_whatsapp' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">WhatsApp Template ID</label>
                                <Input placeholder="Template ID from Meta" value={selectedNode.config.templateId || ''} onChange={e => updateSelectedNode({ config: { ...selectedNode.config, templateId: e.target.value } })} />
                                <p className="text-[11px] text-[var(--vz-text-muted)] mt-1">You must pre-register and approve this template in your WhatsApp Business (Meta) portal before using it here.</p>
                            </div>
                        </div>
                    )}
                    {selectedNode.actionType === 'webhook' && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Webhook URL</label>
                            <Input placeholder="https://..." value={selectedNode.config.url || ''} onChange={e => updateSelectedNode({ config: { ...selectedNode.config, url: e.target.value } })} />
                        </div>
                    )}

                    <div className="pt-4 border-t border-[var(--vz-border)]">
                        <label className="text-sm font-medium flex items-center justify-between">
                            Specific Action Conditions
                            <Button size="xs" variant="outline" onClick={() => updateSelectedNode({ conditions: [...(selectedNode.conditions || []), { field: '', operator: 'equals', value: '' }] })}>+ Add</Button>
                        </label>
                        <div className="space-y-3 mt-3">
                            {(selectedNode.conditions || []).map((cond, i) => (
                                <div key={i} className="flex gap-2 p-3 bg-[var(--vz-bg-secondary)] rounded border border-[var(--vz-border)] items-start">
                                    <div className="flex-1 space-y-2">
                                        <Select size="sm" value={cond.field} onChange={v => {
                                            const newC = [...selectedNode.conditions]; newC[i].field = v; updateSelectedNode({ conditions: newC });
                                        }} options={fieldOptions} />
                                        <Select size="sm" value={cond.operator} onChange={v => {
                                            const newC = [...selectedNode.conditions]; newC[i].operator = v; updateSelectedNode({ conditions: newC });
                                        }} options={Object.entries(operatorLabels).map(([k,v]) => ({value:k, label:v}))} />
                                        <Input size="sm" placeholder="Value" value={cond.value} onChange={e => {
                                            const newC = [...selectedNode.conditions]; newC[i].value = e.target.value; updateSelectedNode({ conditions: newC });
                                        }} />
                                    </div>
                                    <button onClick={() => updateSelectedNode({ conditions: selectedNode.conditions.filter((_, idx) => idx !== i) })} className="text-danger p-1 mt-1 hover:bg-danger/10 rounded"><X size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        if (selectedNode.type === 'wait') {
            return (
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--vz-heading)] flex items-center gap-2">
                            <Clock size={20} className="text-warning" /> Wait Configuration
                        </h3>
                        <p className="text-sm text-[var(--vz-text-muted)]">Pause the automation for a period of time before continuing.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Delay (Minutes)</label>
                        <Input type="number" min="0" value={selectedNode.delayMinutes} onChange={e => updateSelectedNode({ delayMinutes: parseInt(e.target.value) || 0 })} />
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col -m-6 bg-[var(--vz-bg-secondary)]">
            {/* Header */}
            <div className="h-16 bg-[var(--vz-bg)] border-b border-[var(--vz-border)] px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/automations')}><ArrowLeft size={16} /></Button>
                    <Input 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        className="font-semibold text-lg border-transparent hover:border-[var(--vz-border)] focus:border-primary bg-transparent focus:bg-[var(--vz-bg)] w-80 px-2 py-1 h-auto"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={handleSave} disabled={creating || updating} className="flex items-center gap-2 shadow-md">
                        <Settings size={16} /> {id ? 'Update Automation' : 'Save & Activate'}
                    </Button>
                </div>
            </div>

            {/* Main Builder Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Toolbox */}
                <div className="w-64 bg-[var(--vz-bg)] border-r border-[var(--vz-border)] flex flex-col">
                    <div className="p-4 border-b border-[var(--vz-border)] font-semibold text-sm">Add Node</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        
                        <div>
                            <h5 className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase tracking-wider mb-3">Logic</h5>
                            <div className="space-y-2">
                                <div onClick={() => addNode('wait')} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--vz-border)] hover:border-warning hover:bg-warning/5 cursor-pointer bg-[var(--vz-bg-secondary)] transition-all">
                                    <Clock size={16} className="text-warning" /> <span className="text-sm font-medium">Wait / Delay</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h5 className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase tracking-wider mb-3">Actions</h5>
                            <div className="space-y-2">
                                {Object.entries(actionLabels).map(([key, label]) => (
                                    <div key={key} onClick={() => addNode('action', key)} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--vz-border)] hover:border-primary hover:bg-primary/5 cursor-pointer bg-[var(--vz-bg-secondary)] transition-all">
                                        <Play size={16} className="text-primary" /> <span className="text-sm font-medium">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Center Panel: Canvas */}
                <div className="flex-1 overflow-auto bg-[var(--vz-bg-body)] bg-[radial-gradient(var(--vz-border)_1px,transparent_1px)] [background-size:20px_20px] p-8 flex flex-col items-center">
                    
                    {/* Trigger Root */}
                    <div 
                        onClick={() => setSelectedNode('trigger')}
                        className={`w-72 bg-[var(--vz-bg)] border-2 rounded-xl p-4 cursor-pointer transition-all shadow-md flex items-center gap-4 ${selectedNode === 'trigger' ? 'border-primary ring-2 ring-primary/20' : 'border-warning'}`}
                    >
                        <div className="w-12 h-12 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
                            <Zap size={24} className="text-warning" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-warning uppercase tracking-wider">WHEN</span>
                            <h4 className="text-sm font-bold text-[var(--vz-heading)]">{triggerLabels[triggerEvent] || triggerEvent}</h4>
                            <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">{triggerConditions.length} Condition{triggerConditions.length!==1?'s':''}</p>
                        </div>
                    </div>

                    {renderNodeTree(nodes)}

                    {/* End Marker */}
                    <div className="mt-8 flex flex-col items-center opacity-50">
                        <div className="w-2 h-2 rounded-full bg-[var(--vz-border)] mb-1"></div>
                        <div className="w-1 h-1 rounded-full bg-[var(--vz-border)] mb-1"></div>
                        <span className="text-xs font-semibold tracking-widest text-[var(--vz-text-muted)] uppercase">End of Flow</span>
                    </div>

                </div>

                {/* Right Panel: Configuration */}
                <div 
                    style={{ width: `${sidebarWidth}px` }}
                    className="shrink-0 bg-[var(--vz-bg)] border-l border-[var(--vz-border)] flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] relative"
                >
                    {/* Resize Handle */}
                    <div 
                        onMouseDown={handleMouseDown}
                        className="absolute left-0 top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/50 active:bg-primary z-50 transition-colors"
                    />

                    <div className="h-14 border-b border-[var(--vz-border)] flex items-center px-4 font-semibold text-sm">
                        Node Configuration
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {renderConfigPanel()}
                    </div>
                </div>

            </div>
        </div>
    );
}
