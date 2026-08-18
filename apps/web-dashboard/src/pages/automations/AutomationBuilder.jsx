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
import { Zap, Clock, GitBranch, Play, Plus, Settings, ArrowLeft, Trash2, ChevronRight, X, AlertTriangle } from 'lucide-react';

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
    
    // Nodes tree state for UI rendering
    // Root node is just an array of children that come after the trigger.
    const [rootNodes, setRootNodes] = useState([]);
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

    // Tree to Flat Graph Conversion helpers
    const buildTreeFromGraph = (flatNodes, flatEdges, currentId) => {
        const outEdges = flatEdges.filter(e => e.source === currentId);
        
        // standard single-path sequence
        const stdEdge = outEdges.find(e => !e.sourceHandle);
        const children = [];
        
        let ptrEdge = stdEdge;
        while(ptrEdge) {
            const targetNode = flatNodes.find(n => n.id === ptrEdge.target);
            if (!targetNode) break;

            const nObj = { ...targetNode };
            
            if (targetNode.type === 'condition') {
                // Condition nodes have true/false paths instead of a standard sequence
                const tEdge = flatEdges.find(e => e.source === targetNode.id && e.sourceHandle === 'true');
                const fEdge = flatEdges.find(e => e.source === targetNode.id && e.sourceHandle === 'false');
                
                nObj.trueNodes = tEdge ? buildTreeFromGraph(flatNodes, flatEdges, targetNode.id + '_true_placeholder') : []; // We need a way to represent the branch roots. Let's just do a recursive approach that fetches the first node in that branch and follows it.
                // Actually, if we just find the target node, we can treat it as the root of a sub-array.
                
                const buildSequence = (startEdge) => {
                    if (!startEdge) return [];
                    const seq = [];
                    let currEdge = startEdge;
                    while(currEdge) {
                        const tNode = flatNodes.find(n => n.id === currEdge.target);
                        if (!tNode) break;
                        const subN = { ...tNode };
                        if (tNode.type === 'condition') {
                            const ctEdge = flatEdges.find(e => e.source === tNode.id && e.sourceHandle === 'true');
                            const cfEdge = flatEdges.find(e => e.source === tNode.id && e.sourceHandle === 'false');
                            subN.trueNodes = buildSequence(ctEdge);
                            subN.falseNodes = buildSequence(cfEdge);
                            seq.push(subN);
                            break; // Condition nodes end the linear sequence
                        }
                        seq.push(subN);
                        currEdge = flatEdges.find(e => e.source === tNode.id && !e.sourceHandle);
                    }
                    return seq;
                };

                nObj.trueNodes = buildSequence(tEdge);
                nObj.falseNodes = buildSequence(fEdge);
                
                children.push(nObj);
                break; // A condition node ends the current linear array. The paths continue inside it.
            }

            children.push(nObj);
            ptrEdge = flatEdges.find(e => e.source === targetNode.id && !e.sourceHandle);
        }
        
        return children;
    };

    // Simplified for V1: we just have one trigger node in the graph, we find its outgoing edge
    useEffect(() => {
        if (id && existingRules?.data) {
            const rule = existingRules.data.find(r => r._id === id);
            if (rule) {
                setName(rule.name);
                setTriggerEvent(rule.trigger?.event || 'lead.created');
                setTriggerConditions(rule.trigger?.conditions || []);
                
                if (rule.nodes && rule.edges) {
                    const triggerNode = rule.nodes.find(n => n.type === 'trigger');
                    if (triggerNode) {
                        const buildSequence = (startEdge) => {
                            if (!startEdge) return [];
                            const seq = [];
                            let currEdge = startEdge;
                            while(currEdge) {
                                const tNode = rule.nodes.find(n => n.id === currEdge.target);
                                if (!tNode) break;
                                const subN = { ...tNode };
                                if (tNode.type === 'condition') {
                                    const ctEdge = rule.edges.find(e => e.source === tNode.id && e.sourceHandle === 'true');
                                    const cfEdge = rule.edges.find(e => e.source === tNode.id && e.sourceHandle === 'false');
                                    subN.trueNodes = buildSequence(ctEdge);
                                    subN.falseNodes = buildSequence(cfEdge);
                                    seq.push(subN);
                                    break; 
                                }
                                seq.push(subN);
                                currEdge = rule.edges.find(e => e.source === tNode.id && !e.sourceHandle);
                            }
                            return seq;
                        };
                        
                        const rootEdge = rule.edges.find(e => e.source === triggerNode.id);
                        setRootNodes(buildSequence(rootEdge));
                    }
                } else if (rule.actions) {
                    // Legacy migration
                    const mappedNodes = rule.actions.map(act => ({
                        id: generateId(),
                        type: 'action',
                        actionType: act.type,
                        config: act.config || {},
                        delay: { value: act.delay || 0, unit: 'minutes' },
                        conditions: act.conditions || []
                    }));
                    setRootNodes(mappedNodes);
                }
            }
        }
    }, [id, existingRules]);

    const handleSave = async () => {
        if (!name.trim()) return toast('Please enter an automation name', 'error');

        // Compile tree to flat graph
        const flatNodes = [];
        const flatEdges = [];
        
        const triggerNodeId = 'trigger_' + generateId();
        flatNodes.push({ id: triggerNodeId, type: 'trigger' });

        const processSequence = (sequence, sourceId, sourceHandle = null) => {
            let lastId = sourceId;
            let lastHandle = sourceHandle;

            for (const node of sequence) {
                const nodeCopy = { ...node };
                delete nodeCopy.trueNodes;
                delete nodeCopy.falseNodes;
                flatNodes.push(nodeCopy);

                flatEdges.push({
                    id: 'edge_' + generateId(),
                    source: lastId,
                    target: node.id,
                    ...(lastHandle && { sourceHandle: lastHandle })
                });

                if (node.type === 'condition') {
                    processSequence(node.trueNodes || [], node.id, 'true');
                    processSequence(node.falseNodes || [], node.id, 'false');
                    lastId = null; // conditions break the main sequence
                    break; 
                } else {
                    lastId = node.id;
                    lastHandle = null;
                }
            }
        };

        processSequence(rootNodes, triggerNodeId, null);

        const payload = {
            name,
            trigger: { event: triggerEvent, conditions: triggerConditions },
            nodes: flatNodes,
            edges: flatEdges,
            type: 'workflow'
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

    const addNodeToSequence = (type, actionType = null, targetArray, setTargetArray) => {
        const newNode = {
            id: generateId(),
            type,
            ...(type === 'action' && { actionType, config: { useAssignmentPolicy: false }, conditions: [] }),
            ...(type === 'wait' && { delay: { value: 1, unit: 'hours' } }),
            ...(type === 'condition' && { conditions: [], trueNodes: [], falseNodes: [] })
        };
        setTargetArray([...targetArray, newNode]);
        setSelectedNode(newNode);
    };

    // Extremely simplified tree updater for V1
    const updateTreeState = (updater) => {
        const process = (nodes) => {
            return nodes.map(n => {
                const updatedN = updater(n);
                if (updatedN.type === 'condition') {
                    return {
                        ...updatedN,
                        trueNodes: process(updatedN.trueNodes || []),
                        falseNodes: process(updatedN.falseNodes || [])
                    };
                }
                return updatedN;
            });
        };
        setRootNodes(process(rootNodes));
    };

    const updateSelectedNode = (updates) => {
        if (!selectedNode || selectedNode === 'trigger') return;
        
        updateTreeState(n => n.id === selectedNode.id ? { ...n, ...updates } : n);
        setSelectedNode({ ...selectedNode, ...updates });
    };

    const removeNodeFromSequence = (nodeId) => {
        const filterProcess = (nodes) => {
            const filtered = nodes.filter(n => n.id !== nodeId);
            return filtered.map(n => {
                if (n.type === 'condition') {
                    return {
                        ...n,
                        trueNodes: filterProcess(n.trueNodes || []),
                        falseNodes: filterProcess(n.falseNodes || [])
                    };
                }
                return n;
            });
        };
        setRootNodes(filterProcess(rootNodes));
        if (selectedNode?.id === nodeId) setSelectedNode(null);
    };

    // --- RENDERERS ---

    const renderNodeTree = (nodeList, parentArray, setParentArray) => {
        return (
            <div className="flex flex-col items-center">
                {nodeList.map((node, index) => (
                    <div key={node.id} className="relative flex flex-col items-center">
                        {/* Connector Line */}
                        <div className="w-px h-6 bg-[var(--vz-border)]"></div>
                        
                        {/* Node Card */}
                        <div 
                            onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
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
                                    {node.type === 'action' ? actionLabels[node.actionType] : node.type === 'wait' ? `Wait ${node.delay?.value || 0} ${node.delay?.unit || 'minutes'}` : 'Condition'}
                                </h4>
                                <p className="text-xs text-[var(--vz-text-muted)] truncate">
                                    {node.type === 'action' ? 'Executes action' : node.type === 'wait' ? 'Pauses automation' : 'Splits workflow'}
                                </p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); removeNodeFromSequence(node.id); }} className="text-[var(--vz-text-muted)] hover:text-danger p-1 z-10">
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Branch Paths */}
                        {node.type === 'condition' && (
                            <div className="flex w-full mt-4 border-t-2 border-[var(--vz-border)] pt-4 relative min-w-[500px]">
                                {/* True Path */}
                                <div className="flex-1 flex flex-col items-center border-r-2 border-[var(--vz-border)] relative px-4">
                                    <span className="absolute -top-3 bg-[var(--vz-bg-secondary)] px-2 text-xs font-semibold text-success border border-[var(--vz-border)] rounded-full shadow-sm">TRUE</span>
                                    {renderNodeTree(node.trueNodes || [], node.trueNodes || [], (newArr) => {
                                        updateSelectedNode({ trueNodes: newArr });
                                    })}
                                </div>
                                {/* False Path */}
                                <div className="flex-1 flex flex-col items-center relative px-4">
                                    <span className="absolute -top-3 bg-[var(--vz-bg-secondary)] px-2 text-xs font-semibold text-danger border border-[var(--vz-border)] rounded-full shadow-sm">FALSE</span>
                                    {renderNodeTree(node.falseNodes || [], node.falseNodes || [], (newArr) => {
                                        updateSelectedNode({ falseNodes: newArr });
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Add Node Button for this sequence (only if the last node isn't a branch, since branches split the sequence forever in this UI) */}
                {(!nodeList.length || nodeList[nodeList.length - 1].type !== 'condition') && (
                    <div className="flex flex-col items-center">
                        <div className="w-px h-6 bg-[var(--vz-border)]"></div>
                        <Button size="xs" variant="outline" className="rounded-full shadow-sm" onClick={() => {
                            // If they click here, we just add a placeholder or we can use a popover. 
                            // For simplicity, we just prompt to use the sidebar.
                            toast('Select an action from the left sidebar', 'info');
                        }}><Plus size={14} /> Add Step</Button>
                    </div>
                )}
            </div>
        );
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
                                <label className="text-sm font-medium">Assignment Method</label>
                                <Select 
                                    value={selectedNode.config.strategy || 'manual'} 
                                    onChange={v => updateSelectedNode({ config: { ...selectedNode.config, strategy: v, userId: '', userIds: [] } })}
                                    options={[
                                        {value: 'manual', label: 'Assign to Specific User'},
                                        {value: 'round_robin', label: 'Round Robin (Distribute Evenly)'},
                                        {value: 'least_loaded', label: 'Least Busy (Load Based)'},
                                        {value: 'policy', label: 'Use Global Assignment Policy'},
                                    ]}
                                />
                            </div>
                            
                            {selectedNode.config.strategy === 'manual' && (
                                <div className="space-y-1.5 opacity-100 transition-opacity">
                                    <label className="text-sm font-medium">Assign To User</label>
                                    <Select 
                                        value={selectedNode.config.userId || ''} 
                                        onChange={v => updateSelectedNode({ config: { ...selectedNode.config, userId: v } })}
                                        options={[{value: '', label: 'Select User...'}, ...users.map(u => ({ value: u._id, label: u.name }))]}
                                    />
                                </div>
                            )}

                            {(selectedNode.config.strategy === 'round_robin' || selectedNode.config.strategy === 'least_loaded') && (
                                <div className="space-y-1.5 opacity-100 transition-opacity">
                                    <label className="text-sm font-medium">Select Users to Distribute Among</label>
                                    <div className="bg-[var(--vz-bg)] border border-[var(--vz-border)] rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                                        {users.map(u => {
                                            const isChecked = (selectedNode.config.userIds || []).includes(u._id);
                                            return (
                                                <label key={u._id} className="flex items-center gap-2 text-sm p-1 hover:bg-[var(--vz-bg-secondary)] rounded cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            let newUserIds = [...(selectedNode.config.userIds || [])];
                                                            if (e.target.checked) newUserIds.push(u._id);
                                                            else newUserIds = newUserIds.filter(id => id !== u._id);
                                                            updateSelectedNode({ config: { ...selectedNode.config, userIds: newUserIds } });
                                                        }}
                                                    />
                                                    {u.name}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-[var(--vz-text-muted)] mt-1">Select multiple users to rotate assignment.</p>
                                </div>
                            )}
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
                        <p className="text-sm text-[var(--vz-text-muted)]">Pause the automation for a period of time.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Duration</label>
                            <Input type="number" min="0" value={selectedNode.delay?.value || 0} onChange={e => updateSelectedNode({ delay: { ...selectedNode.delay, value: parseInt(e.target.value) || 0 } })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Unit</label>
                            <Select 
                                value={selectedNode.delay?.unit || 'minutes'} 
                                onChange={v => updateSelectedNode({ delay: { ...selectedNode.delay, unit: v } })}
                                options={[
                                    { value: 'minutes', label: 'Minutes' },
                                    { value: 'hours', label: 'Hours' },
                                    { value: 'days', label: 'Days' }
                                ]}
                            />
                        </div>
                    </div>
                </div>
            );
        }

        if (selectedNode.type === 'condition') {
            return (
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--vz-heading)] flex items-center gap-2">
                            <GitBranch size={20} className="text-info" /> Condition Configuration
                        </h3>
                        <p className="text-sm text-[var(--vz-text-muted)]">Split the workflow based on data conditions.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">Conditions</h4>
                            <Button size="xs" variant="outline" onClick={() => updateSelectedNode({ conditions: [...(selectedNode.conditions || []), { field: 'source', operator: 'equals', value: '' }] })}>+ Add Condition</Button>
                        </div>
                        {(selectedNode.conditions || []).map((cond, i) => (
                            <div key={i} className="flex gap-2 p-3 bg-[var(--vz-bg-secondary)] rounded border border-[var(--vz-border)]">
                                <div className="flex-1 space-y-2">
                                    <Select value={cond.field} onChange={val => {
                                        const newC = [...selectedNode.conditions]; newC[i].field = val; updateSelectedNode({ conditions: newC });
                                    }} options={fieldOptions} />
                                    <Select value={cond.operator} onChange={val => {
                                        const newC = [...selectedNode.conditions]; newC[i].operator = val; updateSelectedNode({ conditions: newC });
                                    }} options={Object.entries(operatorLabels).map(([k,v]) => ({value:k, label:v}))} />
                                    <Input placeholder="Value" value={cond.value} onChange={e => {
                                        const newC = [...selectedNode.conditions]; newC[i].value = e.target.value; updateSelectedNode({ conditions: newC });
                                    }} />
                                </div>
                                <button onClick={() => updateSelectedNode({ conditions: selectedNode.conditions.filter((_, idx) => idx !== i) })} className="text-danger p-1"><X size={16}/></button>
                            </div>
                        ))}
                        {(!selectedNode.conditions || selectedNode.conditions.length === 0) && (
                            <div className="text-sm text-warning flex items-center gap-2 p-3 bg-warning/10 rounded">
                                <AlertTriangle size={16} /> Add at least one condition.
                            </div>
                        )}
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
                    <div className="p-4 border-b border-[var(--vz-border)] font-semibold text-sm text-[var(--vz-text-muted)]">
                        Add a node to the main sequence
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        
                        <div>
                            <h5 className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase tracking-wider mb-3">Logic</h5>
                            <div className="space-y-2">
                                <div onClick={() => addNodeToSequence('condition', null, rootNodes, setRootNodes)} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--vz-border)] hover:border-info hover:bg-info/5 cursor-pointer bg-[var(--vz-bg-secondary)] transition-all">
                                    <GitBranch size={16} className="text-info" /> <span className="text-sm font-medium">Condition Branch</span>
                                </div>
                                <div onClick={() => addNodeToSequence('wait', null, rootNodes, setRootNodes)} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--vz-border)] hover:border-warning hover:bg-warning/5 cursor-pointer bg-[var(--vz-bg-secondary)] transition-all">
                                    <Clock size={16} className="text-warning" /> <span className="text-sm font-medium">Wait / Delay</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h5 className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase tracking-wider mb-3">Actions</h5>
                            <div className="space-y-2">
                                {Object.entries(actionLabels).map(([key, label]) => (
                                    <div key={key} onClick={() => addNodeToSequence('action', key, rootNodes, setRootNodes)} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--vz-border)] hover:border-primary hover:bg-primary/5 cursor-pointer bg-[var(--vz-bg-secondary)] transition-all">
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
                        className={`w-72 bg-[var(--vz-bg)] border-2 rounded-xl p-4 cursor-pointer transition-all shadow-md flex items-center gap-4 z-10 ${selectedNode === 'trigger' ? 'border-primary ring-2 ring-primary/20' : 'border-warning'}`}
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

                    {renderNodeTree(rootNodes, rootNodes, setRootNodes)}

                    {/* End Marker */}
                    <div className="mt-8 flex flex-col items-center opacity-50 pb-20">
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
