/**
 * StrategyLibrary Component
 * 
 * Admin feature for creating, editing, and managing reusable exit strategy templates.
 * These templates define exit ladders that can be applied to assets in the Exit Strategy page.
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Library, 
  Target, 
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Copy
} from 'lucide-react';
import {
  type ExitStrategyTemplate,
  type ExitRung,
  type CalculatedExitRung,
  loadTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  validateExits,
  calculateExitMatrix,
  getTemplateSummary,
} from '@/lib/strategyTemplates';
import { type Category, CATEGORY_LABELS, getCategoryColor } from '@/lib/categoryColors';
import { formatPrice } from '@/lib/formatting';

// ============================================================================
// DUMMY TOKEN FOR PREVIEW
// ============================================================================

const DUMMY_TOKEN = {
  symbol: 'DEMO',
  tokensOwned: 1000,
  avgCost: 1.00,
  planBasis: 1.10,  // 10% cushion applied
};

// ============================================================================
// EXIT RUNG EDITOR ROW
// ============================================================================

interface RungEditorRowProps {
  index: number;
  rung: ExitRung;
  calculated: CalculatedExitRung;
  onChange: (index: number, field: 'sellPercent' | 'multiple', value: number) => void;
  onDelete: (index: number) => void;
  disabled?: boolean;
  showDelete?: boolean;
}

function RungEditorRow({ 
  index, 
  rung, 
  calculated, 
  onChange, 
  onDelete, 
  disabled,
  showDelete = true 
}: RungEditorRowProps) {
  return (
    <tr className="border-b border-slate-700/30 hover:bg-slate-800/20 transition-colors">
      <td className="py-2.5 px-3 text-sm text-slate-400">
        Exit {index + 1}
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={rung.sellPercent}
            onChange={(e) => onChange(index, 'sellPercent', parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-right text-sm tabular-nums"
            min="0"
            max="100"
            step="1"
            disabled={disabled}
          />
          <span className="text-xs text-slate-500">%</span>
        </div>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={rung.multiple}
            onChange={(e) => onChange(index, 'multiple', parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-right text-sm tabular-nums"
            min="0"
            step="0.1"
            disabled={disabled}
          />
          <span className="text-xs text-slate-500">×</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-right text-sm tabular-nums text-slate-400">
        {calculated.tokensToSell.toFixed(2)}
      </td>
      <td className="py-2.5 px-3 text-right text-sm tabular-nums">
        {formatPrice(calculated.targetPrice)}
      </td>
      <td className="py-2.5 px-3 text-right text-sm tabular-nums">
        {formatPrice(calculated.proceeds)}
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className={`text-sm font-medium tabular-nums ${calculated.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {calculated.profit >= 0 ? '+' : ''}{formatPrice(calculated.profit)}
        </span>
      </td>
      <td className="py-2.5 px-3">
        {showDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(index)}
            disabled={disabled}
            className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

// ============================================================================
// REMAINING ROW (Non-editable)
// ============================================================================

interface RemainingRowProps {
  remaining: number;
  tokensRemaining: number;
}

function RemainingRow({ remaining, tokensRemaining }: RemainingRowProps) {
  return (
    <tr className="bg-slate-800/30 border-t border-slate-600/30">
      <td className="py-2.5 px-3 text-sm font-medium text-slate-300">
        Remaining
      </td>
      <td className="py-2.5 px-3">
        <span className="text-sm tabular-nums text-slate-400">{remaining.toFixed(1)}%</span>
      </td>
      <td className="py-2.5 px-3 text-sm text-slate-500">—</td>
      <td className="py-2.5 px-3 text-right text-sm tabular-nums text-slate-400">
        {tokensRemaining.toFixed(2)}
      </td>
      <td className="py-2.5 px-3 text-sm text-slate-500">—</td>
      <td className="py-2.5 px-3 text-sm text-slate-500">—</td>
      <td className="py-2.5 px-3 text-sm text-slate-500">—</td>
      <td className="py-2.5 px-3"></td>
    </tr>
  );
}

// ============================================================================
// TEMPLATE EDITOR
// ============================================================================

interface TemplateEditorProps {
  template?: ExitStrategyTemplate;  // Undefined = creating new
  onSave: (template: ExitStrategyTemplate) => void;
  onCancel: () => void;
}

function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const isEditing = !!template;
  
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  // Keep targetCategories for data model compatibility but don't show in UI
  const [targetCategories] = useState<Category[]>(
    template?.targetCategories || ['blue-chip', 'mid-cap', 'low-cap', 'micro-cap']
  );
  const [exits, setExits] = useState<ExitRung[]>(
    template?.exits || [
      { sellPercent: 25, multiple: 2 },
      { sellPercent: 25, multiple: 3 },
      { sellPercent: 25, multiple: 5 },
      { sellPercent: 20, multiple: 10 },
    ]
  );

  // Validation
  const validation = useMemo(() => validateExits(exits), [exits]);
  
  // Calculate preview matrix
  const calculatedMatrix = useMemo(() => {
    return calculateExitMatrix(exits, DUMMY_TOKEN);
  }, [exits]);

  // Summary stats
  const summary = useMemo(() => {
    if (validation.valid && exits.length > 0) {
      return getTemplateSummary({ 
        id: '', 
        name: '', 
        exits, 
        targetCategories, 
        createdAt: 0, 
        updatedAt: 0 
      }, DUMMY_TOKEN);
    }
    return null;
  }, [exits, validation.valid, targetCategories]);

  // Form is valid when name is filled and exits pass validation
  const isFormValid = name.trim().length > 0 && validation.valid && exits.length > 0;

  // Handlers
  const handleRungChange = useCallback((index: number, field: 'sellPercent' | 'multiple', value: number) => {
    setExits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleDeleteRung = useCallback((index: number) => {
    if (exits.length <= 1) {
      toast.error('Must have at least one exit point');
      return;
    }
    setExits(prev => prev.filter((_, i) => i !== index));
  }, [exits.length]);

  const handleAddRung = useCallback(() => {
    if (exits.length >= 10) {
      toast.error('Maximum 10 exit points allowed');
      return;
    }
    // Add with reasonable defaults based on existing pattern
    const lastMultiple = exits.length > 0 ? exits[exits.length - 1].multiple : 1;
    setExits(prev => [...prev, { sellPercent: 10, multiple: lastMultiple * 1.5 }]);
  }, [exits]);

  const handleSave = useCallback(() => {
    // Validate name
    if (!name.trim()) {
      toast.error('Please enter a strategy name');
      return;
    }
    
    // Validate exits
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid exit configuration');
      return;
    }
    
    if (exits.length === 0) {
      toast.error('Please add at least one exit point');
      return;
    }

    if (isEditing && template) {
      // Update existing
      const updated = updateTemplate(template.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        targetCategories,
        exits,
      });
      if (updated) {
        onSave(updated);
        toast.success('Strategy template updated');
      }
    } else {
      // Create new
      const created = createTemplate(name.trim(), exits, {
        description: description.trim() || undefined,
        targetCategories,
      });
      onSave(created);
      toast.success('Strategy template created');
    }
  }, [name, description, targetCategories, exits, validation, isEditing, template, onSave]);

  const tokensRemaining = (DUMMY_TOKEN.tokensOwned * validation.remaining) / 100;

  return (
    <div className="space-y-8">
      {/* ================================================================
          SECTION 1: Page Title and Context
          ================================================================ */}
      <div>
        <h2 className="text-xl font-semibold">
          {isEditing ? 'Edit Strategy' : 'Create New Strategy'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {isEditing 
            ? `Editing "${template?.name}"${template?.isDefault ? ' (default template)' : ''}`
            : 'Define exit points with sell percentages and price multiples'
          }
        </p>
      </div>

      {/* ================================================================
          SECTION 2: Action Bar (Cancel / Create Strategy)
          - Visually separated from form fields
          - Same button quality as Sign Out
          ================================================================ */}
      <div className="flex gap-4 pb-2 border-b border-slate-700/30">
        {/* Cancel - Secondary/Ghost style, same height as primary */}
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-full border border-slate-600 text-slate-300 font-semibold text-sm transition-smooth hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800/30"
        >
          Cancel
        </button>
        
        {/* Create Strategy - Primary style matching Sign Out button exactly */}
        <button
          onClick={handleSave}
          disabled={!isFormValid}
          className="gradient-outline-btn transition-smooth disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
        >
          <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold text-sm">
            {isEditing ? 'Save Changes' : 'Create Strategy'}
          </span>
        </button>
      </div>

      {/* ================================================================
          SECTION 3: Strategy Identity (Name / Description)
          ================================================================ */}
      <div className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="template-name">Strategy Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My Aggressive Strategy"
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-desc">Description (optional)</Label>
          <textarea
            id="template-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this strategy..."
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            rows={2}
          />
        </div>
      </div>

      {/* ================================================================
          SECTION 4: Exit Points Builder
          ================================================================ */}
      <div className="space-y-4">
        {/* Exit Points Header Row - Title, Preview, Warning, and Add Exit all on same line */}
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Title, preview text, and validation warning */}
          <div className="flex items-center gap-4 flex-wrap">
            <h3 className="text-base font-semibold">Exit Points</h3>
            <span className="text-sm text-slate-500">
              Preview using {DUMMY_TOKEN.tokensOwned} tokens @ ${DUMMY_TOKEN.avgCost.toFixed(2)} avg cost (${DUMMY_TOKEN.planBasis.toFixed(2)} plan basis)
            </span>
            {/* Inline Validation Error */}
            {!validation.valid && (
              <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-xs text-red-400 whitespace-nowrap">
                {validation.error}
              </span>
            )}
          </div>
          
          {/* Right side: Add Exit button - Tier 3 CONTEXTUAL style */}
          <button
            onClick={handleAddRung}
            disabled={exits.length >= 10}
            className="px-4 py-2 rounded-full border border-slate-600 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-400 font-medium text-sm transition-smooth disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Exit</span>
          </button>
        </div>

        {/* Exit Table */}
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700/50">
                <th className="text-left py-2.5 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Exit</th>
                <th className="text-left py-2.5 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Sell %</th>
                <th className="text-left py-2.5 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Multiple</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Tokens</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Target</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Proceeds</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Profit</th>
                <th className="py-2.5 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {exits.map((rung, idx) => (
                <RungEditorRow
                  key={idx}
                  index={idx}
                  rung={rung}
                  calculated={calculatedMatrix[idx] || { 
                    sellPercent: 0, 
                    multiple: 0, 
                    tokensToSell: 0, 
                    targetPrice: 0, 
                    proceeds: 0, 
                    profit: 0 
                  }}
                  onChange={handleRungChange}
                  onDelete={handleDeleteRung}
                  showDelete={exits.length > 1}
                />
              ))}
              <RemainingRow 
                remaining={validation.remaining} 
                tokensRemaining={tokensRemaining} 
              />
            </tbody>
          </table>
        </div>

        {/* ================================================================
            SECTION 5: Summary Metrics
            ================================================================ */}
        {summary && validation.valid && (
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Exit Points</div>
              <div className="text-lg font-semibold tabular-nums">{summary.exitCount}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Multiple</div>
              <div className="text-lg font-semibold tabular-nums">{summary.avgMultiple.toFixed(1)}×</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total Proceeds</div>
              <div className="text-lg font-semibold tabular-nums">{formatPrice(summary.totalProceeds)}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Expected Profit</div>
              <div className={`text-lg font-semibold tabular-nums ${summary.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {summary.totalProfit >= 0 ? '+' : ''}{formatPrice(summary.totalProfit)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// TEMPLATE LIST ROW
// ============================================================================

interface TemplateRowProps {
  template: ExitStrategyTemplate;
  onEdit: (template: ExitStrategyTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (template: ExitStrategyTemplate) => void;
}

function TemplateRow({ template, onEdit, onDelete, onDuplicate }: TemplateRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const summary = useMemo(() => {
    return getTemplateSummary(template, DUMMY_TOKEN);
  }, [template]);

  const validation = useMemo(() => validateExits(template.exits), [template.exits]);

  return (
    <div className="border-b border-slate-700/30 last:border-0">
      {/* Main Row */}
      <div 
        className="px-4 py-3 hover:bg-slate-800/30 transition-colors cursor-pointer flex items-center gap-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand Toggle */}
        <button className="p-1 hover:bg-slate-700/30 rounded transition-colors">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {/* Name & Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{template.name}</span>
            {template.isDefault && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-cyan-500/30 text-cyan-400">
                Default
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{template.description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="text-right w-16">
          <div className="text-sm tabular-nums">{template.exits.length}</div>
          <div className="text-[10px] text-slate-500">exits</div>
        </div>

        <div className="text-right w-20">
          <div className="text-sm tabular-nums">{summary.avgMultiple.toFixed(1)}×</div>
          <div className="text-[10px] text-slate-500">avg mult</div>
        </div>

        {/* Actions */}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onEdit(template)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onDuplicate(template)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-500 hover:text-red-400"
                  onClick={() => onDelete(template.id)}
                >
                  {template.isDefault ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {template.isDefault ? 'Reset to Default' : 'Delete'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 ml-10">
          <div className="border border-slate-700/30 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/30 border-b border-slate-700/30">
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Exit</th>
                  <th className="text-right py-2 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Sell %</th>
                  <th className="text-right py-2 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Multiple</th>
                </tr>
              </thead>
              <tbody>
                {template.exits.map((exit, idx) => (
                  <tr key={idx} className="border-b border-slate-700/20 last:border-0">
                    <td className="py-2 px-3 text-slate-400">Exit {idx + 1}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{exit.sellPercent}%</td>
                    <td className="py-2 px-3 text-right tabular-nums">{exit.multiple}×</td>
                  </tr>
                ))}
                <tr className="bg-slate-800/20">
                  <td className="py-2 px-3 text-slate-300 font-medium">Remaining</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">{validation.remaining.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right text-slate-500">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN STRATEGY LIBRARY COMPONENT
// ============================================================================

export function StrategyLibrary() {
  const [templates, setTemplates] = useState<ExitStrategyTemplate[]>(() => loadTemplates());
  const [editingTemplate, setEditingTemplate] = useState<ExitStrategyTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Refresh templates from storage
  const refreshTemplates = useCallback(() => {
    setTemplates(loadTemplates());
  }, []);

  // Handle edit
  const handleEdit = useCallback((template: ExitStrategyTemplate) => {
    setEditingTemplate(template);
    setIsCreating(false);
  }, []);

  // Handle create
  const handleCreate = useCallback(() => {
    setIsCreating(true);
    setEditingTemplate(null);
  }, []);

  // Handle save (create or update)
  const handleSave = useCallback((template: ExitStrategyTemplate) => {
    refreshTemplates();
    setEditingTemplate(null);
    setIsCreating(false);
  }, [refreshTemplates]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setEditingTemplate(null);
    setIsCreating(false);
  }, []);

  // Handle delete
  const handleDelete = useCallback((id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;
    
    if (template.isDefault) {
      // For defaults, just reset
      deleteTemplate(id);
      refreshTemplates();
      toast.success('Template reset to default');
    } else {
      // For custom, confirm first
      setConfirmDelete(id);
    }
  }, [templates, refreshTemplates]);

  // Confirm delete
  const confirmDeleteTemplate = useCallback(() => {
    if (confirmDelete) {
      deleteTemplate(confirmDelete);
      refreshTemplates();
      setConfirmDelete(null);
      toast.success('Template deleted');
    }
  }, [confirmDelete, refreshTemplates]);

  // Handle duplicate
  const handleDuplicate = useCallback((template: ExitStrategyTemplate) => {
    const newTemplate = createTemplate(
      `${template.name} (Copy)`,
      [...template.exits],
      {
        description: template.description,
        targetCategories: [...template.targetCategories],
      }
    );
    refreshTemplates();
    toast.success('Template duplicated');
    // Optionally open editor for the duplicate
    setEditingTemplate(newTemplate);
  }, [refreshTemplates]);

  // Split into defaults and custom
  const defaultTemplates = templates.filter(t => t.isDefault);
  const customTemplates = templates.filter(t => !t.isDefault);

  // Show editor if creating or editing
  if (isCreating || editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate || undefined}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <Card className="border-cyan-500/20 bg-cyan-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Library className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-cyan-300">Strategy Library</p>
              <p className="text-sm text-slate-400 mt-1">
                Create and manage reusable exit strategy templates. These templates can be selected 
                from the dropdown on the Exit Strategy page to quickly apply a predefined exit ladder 
                to any asset.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-400">
          {templates.length} template{templates.length !== 1 ? 's' : ''} total
        </div>
        <button
          onClick={handleCreate}
          className="gradient-outline-btn transition-smooth inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4 text-cyan-400" />
          <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold text-sm">
            Create Strategy
          </span>
        </button>
      </div>

      {/* Default Templates Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan-400" />
            <CardTitle className="text-base">Default Templates</CardTitle>
          </div>
          <CardDescription>
            Built-in strategies that ship with the app. Edit to customize, or reset to restore defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 px-0 pb-0">
          <div className="divide-y divide-slate-700/30">
            {defaultTemplates.map(template => (
              <TemplateRow
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Templates Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Custom Templates</CardTitle>
          <CardDescription>
            Your custom strategies. Duplicate a default template or create from scratch.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 px-0 pb-0">
          {customTemplates.length === 0 ? (
            <div className="p-8 text-center">
              <Library className="h-8 w-8 mx-auto mb-3 text-slate-600" />
              <p className="text-sm text-slate-500">No custom templates yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Click "Create Strategy" or duplicate a default template to get started
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {customTemplates.map(template => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Delete Template?</CardTitle>
              <CardDescription>
                This action cannot be undone. The template will be permanently removed.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteTemplate}>
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default StrategyLibrary;
