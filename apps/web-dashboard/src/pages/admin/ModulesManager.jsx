import { useState, useRef } from 'react'
import { LayoutList, GripVertical, Eye, EyeOff, Trash2, Plus, Loader2, X } from 'lucide-react'
import {
  useListAllModulesQuery, useUpdateModuleMutation, useDeleteModuleMutation,
  useCreateModuleMutation, useReorderModulesMutation,
} from '../../features/modules/moduleApi'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'

export default function ModulesManager() {
  const toast = useToast()
  const { data: modulesResp, isLoading } = useListAllModulesQuery()
  const [updateModule] = useUpdateModuleMutation()
  const [deleteModule] = useDeleteModuleMutation()
  const [createModule, { isLoading: creating }] = useCreateModuleMutation()
  const [reorderModules] = useReorderModulesMutation()
  const [showCreate, setShowCreate] = useState(false)
  const [newModule, setNewModule] = useState({ key: '', label: '', icon: 'Box', path: '/', section: 'MENU' })
  const [showEdit, setShowEdit] = useState(false)
  const [editModuleForm, setEditModuleForm] = useState(null)
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  const allModules = modulesResp?.data || []

  const groupedBySection = allModules.reduce((acc, mod) => {
    if (!acc[mod.section]) acc[mod.section] = []
    if (!mod.parentKey) acc[mod.section].push(mod)
    return acc
  }, {})

  const handleToggleVisibility = async (mod) => {
    try {
      await updateModule({ id: mod._id, isActive: !mod.isActive }).unwrap()
    } catch (err) {
      toast(err.data?.message || 'Failed to update module', 'error')
    }
  }

  const handleDelete = async (mod) => {
    if (!confirm(`Delete module "${mod.label}"?`)) return
    try {
      await deleteModule(mod._id).unwrap()
    } catch (err) {
      toast(err.data?.message || 'Failed to delete module', 'error')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createModule(newModule).unwrap()
      setNewModule({ key: '', label: '', icon: 'Box', path: '/', section: 'MENU' })
      setShowCreate(false)
    } catch (err) {
      toast(err.data?.message || 'Failed to create module', 'error')
    }
  }

  const handleEdit = (mod) => {
    setEditModuleForm({
        id: mod._id,
        label: mod.label,
        icon: mod.icon,
        path: mod.path,
        section: mod.section
    })
    setShowEdit(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
        const { id, ...data } = editModuleForm
        await updateModule({ id, ...data }).unwrap()
        setShowEdit(false)
        setEditModuleForm(null)
    } catch (err) {
        toast(err.data?.message || 'Failed to update module', 'error')
    }
  }

  const handleDragStart = (section, index) => {
    dragItem.current = { section, index }
  }

  const handleDragOver = (e, section, index) => {
    e.preventDefault()
    dragOverItem.current = { section, index }
  }

  const handleDrop = async (section) => {
    if (!dragItem.current || !dragOverItem.current) return
    if (dragItem.current.section !== dragOverItem.current.section) return

    const sectionMods = [...(groupedBySection[section] || [])].sort((a, b) => a.order - b.order)
    const dragIdx = dragItem.current.index
    const dropIdx = dragOverItem.current.index

    if (dragIdx === dropIdx) return

    const [moved] = sectionMods.splice(dragIdx, 1)
    sectionMods.splice(dropIdx, 0, moved)

    const orders = sectionMods.map((m, i) => ({ id: m._id, order: i }))

    try {
      await reorderModules(orders).unwrap()
    } catch (_err) {
      toast('Failed to reorder', 'error')
    }

    dragItem.current = null
    dragOverItem.current = null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  const SECTION_LABELS = { MENU: 'Main Menu', ADMIN: 'Admin Panel', SETTINGS: 'Settings' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--vz-heading)] flex items-center gap-2">
            <LayoutList size={22} className="text-primary" />
            Modules
          </h1>
          <p className="text-sm text-[var(--vz-text-muted)] mt-1">
            Manage sidebar modules — toggle visibility, drag to reorder, and create custom modules
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} variant="primary" size="sm">
          <Plus size={16} className="mr-1" /> Add Module
        </Button>
      </div>

      {/* Create Module Form */}
      {showCreate && (
        <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg p-5" style={{ boxShadow: 'var(--vz-shadow)' }}>
          <h3 className="text-sm font-semibold text-[var(--vz-heading)] mb-4">Add Custom Module</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Input label="Key" placeholder="e.g. tasks" value={newModule.key} onChange={(e) => setNewModule({ ...newModule, key: e.target.value })} />
            <Input label="Label" placeholder="e.g. Tasks" value={newModule.label} onChange={(e) => setNewModule({ ...newModule, label: e.target.value })} />
            <Input label="Path" placeholder="e.g. /tasks" value={newModule.path} onChange={(e) => setNewModule({ ...newModule, path: e.target.value })} />
            <Input label="Icon" placeholder="e.g. CheckSquare" value={newModule.icon} onChange={(e) => setNewModule({ ...newModule, icon: e.target.value })} />
            <div>
              <Select
                value={newModule.section}
                onChange={(val) => setNewModule({ ...newModule, section: val })}
                options={[
                  { value: 'MENU', label: 'Main Menu' },
                  { value: 'SETTINGS', label: 'Settings' },
                  { value: 'ADMIN', label: 'Admin' }
                ]}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* Module Lists by Section */}
      {['MENU', 'ADMIN', 'SETTINGS'].map((section) => {
        const sectionModules = groupedBySection[section]
        if (!sectionModules || sectionModules.length === 0) return null

        const sorted = [...sectionModules].sort((a, b) => a.order - b.order)

        return (
          <div key={section}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--vz-text-muted)] mb-3">
              {SECTION_LABELS[section]} <span className="text-[10px] font-normal">({sorted.length})</span>
            </h3>
            <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg divide-y divide-[var(--vz-border)] overflow-hidden" style={{ boxShadow: 'var(--vz-shadow)' }}>
              {sorted.map((mod, index) => (
                <div
                  key={mod._id}
                  draggable
                  onDragStart={() => handleDragStart(section, index)}
                  onDragOver={(e) => handleDragOver(e, section, index)}
                  onDrop={() => handleDrop(section)}
                  className={`flex items-center justify-between px-5 py-3 hover:bg-[var(--vz-body-bg)]/50 transition-colors cursor-grab active:cursor-grabbing ${
                    !mod.isActive ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical size={16} className="text-[var(--vz-text-muted)]" />
                    <div>
                      <span className="font-medium text-[var(--vz-heading)] text-sm">{mod.label}</span>
                      <span className="ml-2 text-xs text-[var(--vz-text-muted)]">{mod.path}</span>
                    </div>
                    {mod.isSystem && (
                      <Badge color="info">System</Badge>
                    )}
                    {!mod.isActive && (
                      <Badge color="dark">Hidden</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleVisibility(mod)}
                      className={`p-1.5 rounded transition-colors ${
                        mod.isActive
                          ? 'text-green-500 hover:bg-green-500/10'
                          : 'text-red-400 hover:bg-red-500/10'
                      }`}
                      title={mod.isActive ? 'Click to hide from sidebar' : 'Click to show in sidebar'}
                    >
                      {mod.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={() => handleEdit(mod)}
                      className="p-1.5 rounded text-[var(--vz-text-muted)] hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit labels and icons"
                    >
                      <Plus size={15} className="rotate-45" /> {/* Use Plus rotated for now or Pencil if I have it */}
                    </button>
                    {!mod.isSystem && (
                      <button
                        onClick={() => handleDelete(mod)}
                        className="p-1.5 rounded text-[var(--vz-text-muted)] hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Edit Module Modal - Using a simple overlay since I don't see a Global Modal component imported here */}
      {showEdit && editModuleForm && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-[var(--vz-heading)]">Edit Module: {editModuleForm.label}</h3>
                    <button onClick={() => setShowEdit(false)} className="text-[var(--vz-text-muted)] hover:text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleUpdate} className="space-y-4">
                    <Input label="Label" value={editModuleForm.label} onChange={(e) => setEditModuleForm({ ...editModuleForm, label: e.target.value })} />
                    <Input label="Path" value={editModuleForm.path} onChange={(e) => setEditModuleForm({ ...editModuleForm, path: e.target.value })} />
                    <Input label="Icon Name" value={editModuleForm.icon} onChange={(e) => setEditModuleForm({ ...editModuleForm, icon: e.target.value })} />
                    <div>
                        <Select
                            value={editModuleForm.section}
                            onChange={(val) => setEditModuleForm({ ...editModuleForm, section: val })}
                            options={[
                              { value: 'MENU', label: 'Main Menu' },
                              { value: 'SETTINGS', label: 'Settings' },
                              { value: 'ADMIN', label: 'Admin' }
                            ]}
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">Save Changes</Button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}
