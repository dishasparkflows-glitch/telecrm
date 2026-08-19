import React from 'react';
import Input from './Input';
import Select from './Select';

export default function DynamicCustomFieldInput({ field, value, onChange }) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className="w-full px-3 py-2 text-sm rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] outline-none focus:border-primary min-h-[80px]"
          placeholder={field.placeholder || field.label}
          value={value || ''}
          onChange={handleChange}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          placeholder={field.placeholder || field.label}
          value={value || ''}
          onChange={handleChange}
        />
      );
    case 'date':
      return <Input type="date" value={value || ''} onChange={handleChange} />;
    case 'datetime':
      return <Input type="datetime-local" value={value || ''} onChange={handleChange} />;
    case 'time':
      return <Input type="time" value={value || ''} onChange={handleChange} />;
    case 'email':
      return <Input type="email" placeholder={field.placeholder || field.label} value={value || ''} onChange={handleChange} />;
    case 'phone':
      return <Input type="tel" placeholder={field.placeholder || field.label} value={value || ''} onChange={handleChange} />;
    case 'url':
      return <Input type="url" placeholder={field.placeholder || field.label} value={value || ''} onChange={handleChange} />;
    case 'boolean':
    case 'checkbox':
      return (
        <div className="flex items-center pt-2">
          <label className="flex items-center gap-2 text-sm text-[var(--vz-heading)] cursor-pointer">
            <input
              type="checkbox"
              className="rounded text-primary focus:ring-primary w-4 h-4"
              checked={value === true || value === 'true'}
              onChange={(e) => onChange(e.target.checked)}
            />
            {field.label}
          </label>
        </div>
      );
    case 'dropdown':
    case 'select':
      return (
        <Select
          value={value || ''}
          onChange={onChange}
          options={(field.options || []).map(o => ({
            value: o.value || o,
            label: o.label || o
          }))}
        />
      );
    case 'multiselect':
      // Simplified multiselect implementation, ideally we'd use a robust MultiSelect component.
      // Assuming multiple values are stored as an array or comma-separated string.
      const selectedValues = Array.isArray(value) ? value : (value ? value.split(',') : []);
      const handleMultiSelect = (optValue) => {
        if (selectedValues.includes(optValue)) {
          onChange(selectedValues.filter(v => v !== optValue));
        } else {
          onChange([...selectedValues, optValue]);
        }
      };
      return (
        <div className="space-y-1.5 p-2 bg-[var(--vz-input-bg)] border border-[var(--vz-input-border)] rounded-md">
          {(field.options || []).map((o, idx) => {
            const optVal = o.value || o;
            const optLabel = o.label || o;
            return (
              <label key={idx} className="flex items-center gap-2 text-sm text-[var(--vz-heading)] cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                  checked={selectedValues.includes(optVal)}
                  onChange={() => handleMultiSelect(optVal)}
                />
                {optLabel}
              </label>
            );
          })}
        </div>
      );
    case 'radio':
      return (
        <div className="space-y-2 pt-1">
          {(field.options || []).map((o, idx) => {
            const optVal = o.value || o;
            const optLabel = o.label || o;
            return (
              <label key={idx} className="flex items-center gap-2 text-sm text-[var(--vz-heading)] cursor-pointer">
                <input
                  type="radio"
                  name={`radio_${field._id}`}
                  className="text-primary focus:ring-primary"
                  checked={value === optVal}
                  onChange={() => onChange(optVal)}
                />
                {optLabel}
              </label>
            );
          })}
        </div>
      );
    case 'text':
    default:
      return (
        <Input
          type="text"
          placeholder={field.placeholder || field.label}
          value={value || ''}
          onChange={handleChange}
        />
      );
  }
}
