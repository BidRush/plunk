import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@plunk/ui';
import type {FilterCondition, FilterGroup, SegmentFilter, SegmentFilterOperator} from '@plunk/types';
import {Check, ChevronsUpDown, GripVertical, Plus, Search, Trash2} from 'lucide-react';
import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {network} from '../lib/network';

const STANDARD_OPERATORS: {value: SegmentFilterOperator; label: string}[] = [
  {value: 'equals', label: 'Equals'},
  {value: 'notEquals', label: 'Not equals'},
  {value: 'startsWith', label: 'Starts with'},
  {value: 'contains', label: 'Contains'},
  {value: 'notContains', label: 'Does not contain'},
  {value: 'greaterThan', label: 'Greater than'},
  {value: 'lessThan', label: 'Less than'},
  {value: 'greaterThanOrEqual', label: 'Greater than or equal to'},
  {value: 'lessThanOrEqual', label: 'Less than or equal to'},
  {value: 'exists', label: 'Exists'},
  {value: 'notExists', label: 'Does not exist'},
  {value: 'within', label: 'Younger than (time)'},
  {value: 'olderThan', label: 'Older than (time)'},
];

const EVENT_OPERATORS: {value: SegmentFilterOperator; label: string}[] = [
  {value: 'triggered', label: 'Ever occurred'},
  {value: 'triggeredWithin', label: 'Occurred within'},
  {value: 'triggeredOlderThan', label: 'Occurred over (time) ago'},
  {value: 'notTriggered', label: 'Never occurred'},
];

const TIME_UNITS = [
  {value: 'minutes', label: 'Minutes'},
  {value: 'hours', label: 'Hours'},
  {value: 'days', label: 'Days'},
] as const;

const STANDARD_FIELDS = [
  // Contact fields
  {value: 'email', label: 'Email', type: 'string', category: 'Contact Fields'},
  {value: 'subscribed', label: 'Subscribed', type: 'boolean', category: 'Contact Fields'},
  {value: 'createdAt', label: 'Created At', type: 'date', category: 'Contact Fields'},
  {value: 'updatedAt', label: 'Updated At', type: 'date', category: 'Contact Fields'},
] as const;

interface FieldOption {
  value: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'event' | 'email';
  category: 'Contact Fields' | 'Custom Data' | 'Events' | 'Email Activity';
}

// Hook to fetch available fields and events
function useAvailableOptions() {
  const [fields, setFields] = useState<FieldOption[]>([...STANDARD_FIELDS]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // Fetch contact fields with types
        const fieldsData = await network.fetch<{
          fields: Array<{field: string; type: 'string' | 'number' | 'boolean' | 'date'}>;
        }>('GET', '/contacts/fields');

        // Fetch event names
        const eventsData = await network.fetch<{eventNames: string[]}>('GET', '/events/names');

        // Build field options from typed fields
        const typedFields: FieldOption[] = (fieldsData.fields || []).map(f => {
          const isCustomData = f.field.startsWith('data.');
          return {
            value: f.field,
            label: isCustomData ? f.field.replace('data.', '') : f.field,
            type: f.type,
            category: isCustomData ? ('Custom Data' as const) : ('Contact Fields' as const),
          };
        });

        // Build event options
        const eventOptions: FieldOption[] = [];
        const emailOptions: FieldOption[] = [];

        (eventsData.eventNames || []).forEach((name: string) => {
          if (name.startsWith('email.')) {
            emailOptions.push({
              value: name,
              label: name
                .replace('email.', '')
                .replace(/([A-Z])/g, ' $1')
                .trim(),
              type: 'event' as const,
              category: 'Email Activity' as const,
            });
          } else {
            // Ensure event has the 'event.' prefix for backend compatibility
            const eventValue = name.startsWith('event.') ? name : `event.${name}`;
            eventOptions.push({
              value: eventValue,
              label: name.replace(/^event\./, ''), // Remove prefix from label for display
              type: 'event' as const,
              category: 'Events' as const,
            });
          }
        });

        setFields([...typedFields, ...eventOptions, ...emailOptions]);
      } catch (error) {
        console.error('Failed to fetch available fields and events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, []);

  return {fields, loading};
}

interface FilterRowProps {
  filter: SegmentFilter;
  onChange: (filter: SegmentFilter) => void;
  onRemove: () => void;
  availableFields: FieldOption[];
}

const FilterRow = memo(function FilterRow({filter, onChange, onRemove, availableFields}: FilterRowProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Helper to get default value based on field type
  const getDefaultValueForType = useCallback((type: string) => {
    switch (type) {
      case 'boolean':
        return true;
      case 'number':
        return 0;
      case 'date':
        return '';
      default:
        return '';
    }
  }, []);

  // Helper to get valid operators for a field type
  const getOperatorsForType = useCallback((type: string, isEvent: boolean) => {
    if (isEvent) {
      return EVENT_OPERATORS;
    }

    if (type === 'boolean') {
      return STANDARD_OPERATORS.filter(op => ['equals', 'notEquals', 'exists', 'notExists'].includes(op.value));
    }

    if (type === 'number' || type === 'date') {
      return STANDARD_OPERATORS.filter(op =>
        [
          'equals',
          'notEquals',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqual',
          'lessThanOrEqual',
          'exists',
          'notExists',
          'within',
          'olderThan',
        ].includes(op.value),
      );
    }

    // String type - no within operator, no comparison operators
    return STANDARD_OPERATORS.filter(op =>
      ['equals', 'notEquals', 'startsWith', 'contains', 'notContains', 'exists', 'notExists'].includes(op.value),
    );
  }, []);

  const needsValue = !['exists', 'notExists', 'triggered', 'notTriggered'].includes(filter.operator);
  const needsUnit = ['within', 'triggeredWithin', 'olderThan', 'triggeredOlderThan'].includes(filter.operator);

  // Get field type from available fields
  const fieldOption = useMemo(
    () => availableFields.find(f => f.value === filter.field),
    [availableFields, filter.field],
  );
  const fieldType = fieldOption?.type || 'string';

  const isEventOrEmailActivity = fieldType === 'event' || fieldType === 'email';

  // Get operators based on field type (memoized)
  const operators = useMemo(() => {
    if (isEventOrEmailActivity) {
      return EVENT_OPERATORS;
    }

    // Filter operators based on field type
    if (fieldType === 'boolean') {
      return STANDARD_OPERATORS.filter(op => ['equals', 'notEquals', 'exists', 'notExists'].includes(op.value));
    }

    if (fieldType === 'number' || fieldType === 'date') {
      return STANDARD_OPERATORS.filter(op =>
        [
          'equals',
          'notEquals',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqual',
          'lessThanOrEqual',
          'exists',
          'notExists',
          'within',
          'olderThan',
        ].includes(op.value),
      );
    }

    // String type - no within operator, no comparison operators
    return STANDARD_OPERATORS.filter(op =>
      ['equals', 'notEquals', 'startsWith', 'contains', 'notContains', 'exists', 'notExists'].includes(op.value),
    );
  }, [fieldType, isEventOrEmailActivity]);

  const handleFieldChange = useCallback(
    (value: string) => {
      const selectedField = availableFields.find(f => f.value === value);
      const newFieldType = selectedField?.type || 'string';
      const isEvent = newFieldType === 'event' || newFieldType === 'email';
      const currentOperatorIsEvent = ['triggered', 'triggeredWithin', 'triggeredOlderThan', 'notTriggered'].includes(
        filter.operator,
      );

      // Determine default operator and value based on new field type
      let newOperator = filter.operator;
      let newValue: string | number | boolean | undefined = undefined;
      let newUnit: 'days' | 'hours' | 'minutes' | undefined = undefined;

      if (isEvent && !currentOperatorIsEvent) {
        // Switching to event field
        newOperator = 'triggered';
        newValue = undefined;
        newUnit = undefined;
      } else if (!isEvent && currentOperatorIsEvent) {
        // Switching from event to non-event field
        newOperator = 'equals';
        newValue = getDefaultValueForType(newFieldType);
        newUnit = undefined;
      } else if (fieldType !== newFieldType) {
        // Field type changed (e.g., date to boolean, number to string)
        // Check if current operator is valid for new type
        const validOperators = getOperatorsForType(newFieldType, isEvent);
        const isOperatorValid = validOperators.some(op => op.value === filter.operator);

        if (!isOperatorValid) {
          newOperator = 'equals';
        }

        // Reset value to appropriate default for new type
        newValue = getDefaultValueForType(newFieldType);

        // Always clear unit when changing field types, even if operator is still valid
        // This handles cases like switching from date "within" to string field
        newUnit = undefined;

        // If the new operator doesn't support units but we had them, ensure value is appropriate
        const newOperatorNeedsUnit = ['within', 'triggeredWithin', 'olderThan', 'triggeredOlderThan'].includes(
          newOperator,
        );
        if (!newOperatorNeedsUnit) {
          // Convert numeric value back to appropriate type for the field
          newValue = getDefaultValueForType(newFieldType);
        }
      }

      onChange({
        field: value,
        operator: newOperator,
        value: newValue,
        unit: newUnit,
      });

      setOpen(false);
      setSearch('');
    },
    [availableFields, filter.operator, fieldType, onChange, getDefaultValueForType, getOperatorsForType],
  );

  // Get label for selected field
  const getFieldLabel = useCallback(() => {
    const field = availableFields.find(f => f.value === filter.field);
    return field?.label || filter.field;
  }, [availableFields, filter.field]);

  // Group fields by category for display (memoized to avoid expensive reduce on every render)
  const groupedFields = useMemo(() => {
    return availableFields.reduce<Record<string, FieldOption[]>>((acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category]!.push(field);
      return acc;
    }, {});
  }, [availableFields]);

  // Filter fields based on search (memoized to avoid expensive filter on every keystroke)
  const filteredGroups = useMemo(() => {
    return Object.entries(groupedFields).reduce(
      (acc, [category, fields]) => {
        const filtered = fields.filter(
          f =>
            f.label.toLowerCase().includes(search.toLowerCase()) ||
            f.value.toLowerCase().includes(search.toLowerCase()),
        );
        if (filtered.length > 0) {
          acc[category] = filtered;
        }
        return acc;
      },
      {} as Record<string, FieldOption[]>,
    );
  }, [groupedFields, search]);

  return (
    <div className="flex items-start gap-2 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
      <div className="flex-1 grid grid-cols-3 gap-3">
        {/* Field Selection */}
        <div className="space-y-1.5">
          <Label className="text-xs text-neutral-600">Field</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between text-sm font-normal"
              >
                <span className="truncate">{getFieldLabel()}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
              <div className="flex items-center border-b px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input
                  placeholder="Search fields, events, or email activity..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto p-1">
                {Object.keys(filteredGroups).length === 0 ? (
                  <div className="py-6 text-center text-sm text-neutral-500">No fields or events found.</div>
                ) : (
                  Object.entries(filteredGroups).map(([category, fields]) => (
                    <div key={category} className="py-1">
                      <div className="px-2 py-1.5 text-xs font-semibold text-neutral-500">{category}</div>
                      {fields.map(field => (
                        <button
                          key={field.value}
                          onClick={() => handleFieldChange(field.value)}
                          className="w-full flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-neutral-100 cursor-pointer text-left"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filter.field === field.value ? 'opacity-100' : 'opacity-0'}`}
                          />
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-neutral-900">{field.label}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono">
                                {field.type}
                              </span>
                            </div>
                            {field.value !== field.label && (
                              <span className="text-xs text-neutral-500">{field.value}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Operator Selection */}
        <div className="space-y-1.5">
          <Label className="text-xs text-neutral-600">Operator</Label>
          <Select
            value={filter.operator}
            onValueChange={(v: SegmentFilterOperator) => {
              const newOperator = v;
              const oldOperator = filter.operator;

              // Check if we're switching between operators that need different value types
              const oldNeedsValue = !['exists', 'notExists', 'triggered', 'notTriggered'].includes(oldOperator);
              const newNeedsValue = !['exists', 'notExists', 'triggered', 'notTriggered'].includes(newOperator);
              const oldNeedsUnit = ['within', 'triggeredWithin', 'olderThan', 'triggeredOlderThan'].includes(
                oldOperator,
              );
              const newNeedsUnit = ['within', 'triggeredWithin', 'olderThan', 'triggeredOlderThan'].includes(
                newOperator,
              );

              const updatedFilter: SegmentFilter = {...filter, operator: newOperator};

              // Clear value if new operator doesn't need one
              if (!newNeedsValue && oldNeedsValue) {
                updatedFilter.value = undefined;
              }

              // Clear or set unit appropriately
              if (!newNeedsUnit && oldNeedsUnit) {
                updatedFilter.unit = undefined;
              } else if (newNeedsUnit && !oldNeedsUnit) {
                updatedFilter.unit = 'days';
                // Set default numeric value if needed
                if (typeof updatedFilter.value !== 'number') {
                  updatedFilter.value = 7;
                }
              }

              // If switching to an operator that needs a value but we don't have one, set default
              if (newNeedsValue && !oldNeedsValue) {
                updatedFilter.value = getDefaultValueForType(fieldType);
              }

              onChange(updatedFilter);
            }}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map(op => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Value Input */}
        <div className="space-y-1.5">
          <Label className="text-xs text-neutral-600">Value</Label>
          {!needsValue ? (
            <div className="h-9 flex items-center text-sm text-neutral-400 px-3 bg-neutral-100 rounded border border-neutral-200">
              No value needed
            </div>
          ) : needsUnit ? (
            <div className="flex gap-1">
              <Input
                type="number"
                value={filter.value as number}
                onChange={e => onChange({...filter, value: parseInt(e.target.value) || 0})}
                className="text-sm flex-1"
                min="1"
              />
              <Select
                value={filter.unit || 'days'}
                onValueChange={(v: 'days' | 'hours' | 'minutes') => onChange({...filter, unit: v})}
              >
                <SelectTrigger className="text-sm w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_UNITS.map(unit => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : fieldType === 'boolean' ? (
            <Select
              value={String(filter.value ?? 'true')}
              onValueChange={v => onChange({...filter, value: v === 'true'})}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
          ) : fieldType === 'number' ? (
            <Input
              type="number"
              value={typeof filter.value === 'number' ? filter.value : ''}
              onChange={e => {
                const val = e.target.value;
                onChange({...filter, value: val === '' ? 0 : parseFloat(val) || 0});
              }}
              className="text-sm"
              placeholder="Enter number"
            />
          ) : fieldType === 'date' ? (
            <Input
              type="date"
              value={filter.value ? String(filter.value).split('T')[0] : ''}
              onChange={e => onChange({...filter, value: e.target.value})}
              className="text-sm"
            />
          ) : (
            <Input
              type="text"
              value={String(filter.value ?? '')}
              onChange={e => onChange({...filter, value: e.target.value})}
              className="text-sm"
              placeholder="Enter value"
            />
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="mt-6 text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
});

interface FilterGroupComponentProps {
  group: FilterGroup;
  onChange: (group: FilterGroup) => void;
  onRemove?: () => void;
  depth?: number;
  availableFields: FieldOption[];
}

function FilterGroupComponent({group, onChange, onRemove, depth = 0, availableFields}: FilterGroupComponentProps) {
  const addFilter = useCallback(() => {
    onChange({
      ...group,
      filters: [...group.filters, {field: 'email', operator: 'contains', value: ''}],
    });
  }, [group, onChange]);

  const updateFilter = useCallback(
    (index: number, filter: SegmentFilter) => {
      onChange({
        ...group,
        filters: group.filters.map((f, i) => (i === index ? filter : f)),
      });
    },
    [group, onChange],
  );

  const removeFilter = useCallback(
    (index: number) => {
      onChange({
        ...group,
        filters: group.filters.filter((_, i) => i !== index),
      });
    },
    [group, onChange],
  );

  const addNestedCondition = useCallback(() => {
    onChange({
      ...group,
      conditions: {
        logic: 'AND',
        groups: [{filters: [{field: 'email', operator: 'contains', value: ''}]}],
      },
    });
  }, [group, onChange]);

  const updateNestedCondition = useCallback(
    (condition: FilterCondition) => {
      onChange({
        ...group,
        conditions: condition,
      });
    },
    [group, onChange],
  );

  const removeNestedCondition = useCallback(() => {
    const rest = {...group};
    delete rest.conditions;
    onChange(rest);
  }, [group, onChange]);

  const bgColors = ['bg-white', 'bg-blue-50/50', 'bg-purple-50/50', 'bg-green-50/50'];
  const borderColors = ['border-neutral-300', 'border-blue-300', 'border-purple-300', 'border-green-300'];

  return (
    <div
      className={`p-4 rounded-lg border-2 ${borderColors[depth % borderColors.length]} ${bgColors[depth % bgColors.length]}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700">Filter Group {depth > 0 && `(Nested)`}</span>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {group.filters.map((filter, index) => (
          <FilterRow
            key={`${filter.field}-${filter.operator}-${index}`}
            filter={filter}
            onChange={f => updateFilter(index, f)}
            onRemove={() => removeFilter(index)}
            availableFields={availableFields}
          />
        ))}

        {group.conditions && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Nested Conditions</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeNestedCondition}
                className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Remove nested
              </Button>
            </div>
            <FilterConditionComponent
              condition={group.conditions}
              onChange={updateNestedCondition}
              depth={depth + 1}
              availableFields={availableFields}
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={addFilter} className="flex-1">
            <Plus className="h-3 w-3 mr-1" />
            Add Filter
          </Button>
          {!group.conditions && (
            <Button type="button" variant="outline" size="sm" onClick={addNestedCondition} className="flex-1">
              <Plus className="h-3 w-3 mr-1" />
              Add Nested Condition
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FilterConditionComponentProps {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
  depth?: number;
  availableFields: FieldOption[];
}

function FilterConditionComponent({condition, onChange, depth = 0, availableFields}: FilterConditionComponentProps) {
  const addGroup = useCallback(() => {
    onChange({
      ...condition,
      groups: [...condition.groups, {filters: [{field: 'email', operator: 'contains', value: ''}]}],
    });
  }, [condition, onChange]);

  const updateGroup = useCallback(
    (index: number, group: FilterGroup) => {
      onChange({
        ...condition,
        groups: condition.groups.map((g, i) => (i === index ? group : g)),
      });
    },
    [condition, onChange],
  );

  const removeGroup = useCallback(
    (index: number) => {
      onChange({
        ...condition,
        groups: condition.groups.filter((_, i) => i !== index),
      });
    },
    [condition, onChange],
  );

  const toggleLogic = useCallback(() => {
    onChange({
      ...condition,
      logic: condition.logic === 'AND' ? 'OR' : 'AND',
    });
  }, [condition, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-600">Groups are combined with:</span>
          <Button
            type="button"
            variant={condition.logic === 'AND' ? 'default' : 'outline'}
            size="sm"
            onClick={toggleLogic}
            className="font-mono font-bold"
          >
            {condition.logic}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {condition.groups.map((group, index) => (
          <div key={`group-${depth}-${index}-${group.filters.length}`}>
            {index > 0 && (
              <div className="flex items-center justify-center my-2">
                <div className="px-3 py-1 bg-neutral-900 text-white text-xs font-bold font-mono rounded-full">
                  {condition.logic}
                </div>
              </div>
            )}
            <FilterGroupComponent
              group={group}
              onChange={g => updateGroup(index, g)}
              onRemove={condition.groups.length > 1 ? () => removeGroup(index) : undefined}
              depth={depth}
              availableFields={availableFields}
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addGroup} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Group
      </Button>
    </div>
  );
}

interface SegmentFilterBuilderProps {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
}

export function SegmentFilterBuilder({condition, onChange}: SegmentFilterBuilderProps) {
  const {fields, loading} = useAvailableOptions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Filter Conditions</h3>
          <p className="text-sm text-neutral-500 mt-1">Build complex audience filters with AND/OR logic</p>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-neutral-500 py-4">Loading available fields and events...</div>
      ) : (
        <FilterConditionComponent condition={condition} onChange={onChange} availableFields={fields} />
      )}
    </div>
  );
}
