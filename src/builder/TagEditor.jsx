/**
 * TagEditor — Data-driven tag editor component.
 *
 * Renders dynamic fields from tagSchema.js based on event type.
 * Supports add/remove tags, field editing, and event-ref search.
 */

import React, { useState, useMemo } from 'react';
import { TAG_SCHEMAS, TAGS_BY_EVENT_TYPE, getTagSchema, valuesToTag, tagToValues } from './tagSchema.js';
import DOSButton from './DOSButton.jsx';

/** Input styled for DOS aesthetic */
function DOSInput({ value, onChange, placeholder, type = 'text', className = '', style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-transparent outline-none font-mono text-xs px-1 ${className}`}
      style={{
        color: 'var(--colour-text)',
        border: '1px solid var(--colour-dim)',
        width: '100%',
        ...style,
      }}
    />
  );
}

function DOSTextarea({ value, onChange, placeholder, rows = 3, style = {} }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="bg-transparent outline-none font-mono text-xs px-1 w-full resize-y"
      style={{
        color: 'var(--colour-text)',
        border: '1px solid var(--colour-dim)',
        ...style,
      }}
    />
  );
}

function DOSSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent outline-none font-mono text-xs px-1 cursor-pointer"
      style={{
        color: 'var(--colour-text)',
        border: '1px solid var(--colour-dim)',
        backgroundColor: 'var(--colour-bg)',
        width: '100%',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

/** Event ref selector — searchable dropdown of known events */
function EventRefSelect({ value, onChange, events, eventTypeFilter }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    if (!events) return [];
    const results = [];
    for (const [aTag, event] of events) {
      const typeTag = event.tags.find((t) => t[0] === 'type')?.[1];
      if (eventTypeFilter && typeTag !== eventTypeFilter) continue;
      const title = event.tags.find((t) => t[0] === 'title')?.[1] || '';
      const dTag = event.tags.find((t) => t[0] === 'd')?.[1] || '';
      results.push({ aTag, title, dTag, type: typeTag });
    }
    // Sort by type then title
    results.sort((a, b) => (a.type || '').localeCompare(b.type || '') || (a.title || '').localeCompare(b.title || ''));
    return results;
  }, [events, eventTypeFilter]);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) =>
      o.title.toLowerCase().includes(q) ||
      o.dTag.toLowerCase().includes(q) ||
      o.aTag.toLowerCase().includes(q)
    );
  }, [options, search]);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const found = options.find((o) => o.aTag === value);
    return found ? `${found.title || found.dTag}` : value.split(':').slice(2).join(':');
  }, [value, options]);

  return (
    <div className="relative w-full">
      <div
        className="flex items-center cursor-pointer px-1"
        style={{ border: '1px solid var(--colour-dim)', minHeight: '1.5em' }}
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 text-xs truncate" style={{ color: value ? 'var(--colour-text)' : 'var(--colour-dim)' }}>
          {selectedLabel || 'Select event...'}
        </span>
        <span style={{ color: 'var(--colour-dim)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 z-50"
          style={{
            backgroundColor: 'var(--colour-bg)',
            border: '1px solid var(--colour-dim)',
            maxHeight: '12em',
            overflowY: 'auto',
          }}
        >
          <DOSInput
            value={search}
            onChange={setSearch}
            placeholder="Search..."
            style={{ borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
          />
          {filtered.length === 0 && (
            <div className="px-1 py-1" style={{ color: 'var(--colour-dim)' }}>No matches</div>
          )}
          {filtered.map((opt) => (
            <div
              key={opt.aTag}
              className="px-1 py-0.5 cursor-pointer hover:opacity-80"
              style={{
                color: opt.aTag === value ? 'var(--colour-highlight)' : 'var(--colour-text)',
                backgroundColor: opt.aTag === value ? 'var(--colour-dim)' : 'transparent',
              }}
              onClick={() => { onChange(opt.aTag); setOpen(false); setSearch(''); }}
            >
              <span style={{ color: 'var(--colour-dim)' }}>[{opt.type}]</span> {opt.title || opt.dTag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render a single field based on its type */
function TagField({ field, value, onChange, events }) {
  switch (field.type) {
    case 'text':
    case 'aliases':
      return <DOSInput value={value} onChange={onChange} placeholder={field.placeholder} />;
    case 'number':
      return <DOSInput value={value} onChange={onChange} placeholder={field.placeholder} type="number" />;
    case 'textarea':
      return <DOSTextarea value={value} onChange={onChange} placeholder={field.placeholder} />;
    case 'select':
      return <DOSSelect value={value} onChange={onChange} options={field.options} placeholder="Select..." />;
    case 'event-ref':
      return <EventRefSelect value={value} onChange={onChange} events={events} eventTypeFilter={field.eventTypeFilter} />;
    default:
      return <DOSInput value={value} onChange={onChange} placeholder={field.placeholder} />;
  }
}

/** A single tag row with its fields */
function TagRow({ tagName, tag, fields, onChange, onRemove, events }) {
  const values = tagToValues(tag, fields);

  function updateField(fieldName, newValue) {
    const updated = { ...values, [fieldName]: newValue };
    onChange(valuesToTag(tagName, updated, fields));
  }

  return (
    <div className="flex gap-1 items-start mb-1">
      <span
        className="shrink-0 px-1 mt-0.5"
        style={{ color: 'var(--colour-dim)', minWidth: '8em', fontSize: '0.65rem' }}
      >
        {tagName}
      </span>
      <div className="flex-1 flex flex-col gap-0.5">
        {fields.map((field) => (
          <div key={field.name}>
            <TagField
              field={field}
              value={values[field.name] || ''}
              onChange={(v) => updateField(field.name, v)}
              events={events}
            />
          </div>
        ))}
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 cursor-pointer mt-0.5"
        style={{ color: 'var(--colour-error)', background: 'none', border: 'none', font: 'inherit', padding: '0 2px' }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * TagEditor component.
 *
 * @param {Object} props
 * @param {string} props.eventType - e.g. 'place', 'portal'
 * @param {string[][]} props.tags - current tag arrays
 * @param {function} props.onChange - called with updated tags array
 * @param {Map} props.events - known events for event-ref dropdowns
 */
export default function TagEditor({ eventType, tags, onChange, events }) {
  const [addTagName, setAddTagName] = useState('');

  // Available tags for this event type (excluding auto-managed ones)
  const availableTags = useMemo(() => {
    const allowed = TAGS_BY_EVENT_TYPE[eventType] || [];
    return allowed.filter((name) => {
      const schema = TAG_SCHEMAS[name];
      if (!schema) return false;
      if (schema.auto) return false; // d, t, type are auto-managed
      // Non-repeatable: only show if not already present
      if (!schema.repeatable && !schema.variants?.place?.repeatable && !schema.variants?.portal?.repeatable) {
        const exists = tags.some((t) => t[0] === name);
        if (exists) return false;
      }
      return true;
    });
  }, [eventType, tags]);

  function addTag(tagName) {
    const schema = getTagSchema(tagName, eventType);
    if (!schema) return;
    // Create empty tag with correct number of fields
    const emptyTag = [tagName, ...schema.fields.map(() => '')];
    onChange([...tags, emptyTag]);
    setAddTagName('');
  }

  function updateTag(index, newTag) {
    const updated = [...tags];
    updated[index] = newTag;
    onChange(updated);
  }

  function removeTag(index) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div>
      {/* Existing tags */}
      {tags.map((tag, i) => {
        const schema = getTagSchema(tag[0], eventType);
        if (!schema) {
          // Unknown tag — render raw
          return (
            <div key={i} className="flex gap-1 items-center mb-1">
              <span className="shrink-0 px-1" style={{ color: 'var(--colour-dim)', minWidth: '8em', fontSize: '0.65rem' }}>
                {tag[0]}
              </span>
              <span className="flex-1 text-xs" style={{ color: 'var(--colour-dim)' }}>
                {tag.slice(1).join(' | ')}
              </span>
              <button
                onClick={() => removeTag(i)}
                className="shrink-0 cursor-pointer"
                style={{ color: 'var(--colour-error)', background: 'none', border: 'none', font: 'inherit', padding: '0 2px' }}
              >
                ×
              </button>
            </div>
          );
        }
        return (
          <TagRow
            key={`${tag[0]}-${i}`}
            tagName={tag[0]}
            tag={tag}
            fields={schema.fields}
            onChange={(newTag) => updateTag(i, newTag)}
            onRemove={() => removeTag(i)}
            events={events}
          />
        );
      })}

      {/* Add tag dropdown */}
      {availableTags.length > 0 && (
        <div className="flex gap-1 mt-2">
          <DOSSelect
            value={addTagName}
            onChange={setAddTagName}
            options={availableTags}
            placeholder="+ Add tag..."
          />
          {addTagName && (
            <DOSButton onClick={() => addTag(addTagName)} colour="text">
              Add
            </DOSButton>
          )}
        </div>
      )}
    </div>
  );
}
