import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NamePromptModalProps {
  open: boolean;
  onSave: (firstName: string, lastName: string) => Promise<void>;
  onSkip: () => Promise<void>;
  isLoading?: boolean;
  initialFirstName?: string;
  initialLastName?: string;
  isEditMode?: boolean;
}

export function NamePromptModal({
  open,
  onSave,
  onSkip,
  isLoading = false,
  initialFirstName = '',
  initialLastName = '',
  isEditMode = false,
}: NamePromptModalProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);

  const handleSave = async () => {
    await onSave(firstName.trim(), lastName.trim());
  };

  const handleSkip = async () => {
    await onSkip();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="glass-panel sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">
            {isEditMode ? 'Edit Your Name' : 'Welcome!'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update your display name.'
              : 'Add your name to personalize your portfolio tracker. You can skip this and add it later.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              placeholder="Enter your first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isLoading}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              placeholder="Enter your last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isLoading}
              className="bg-background/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {!isEditMode && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip
            </Button>
          )}
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="gradient-outline-btn text-sm transition-smooth disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                  Saving...
                </span>
              </>
            ) : (
              <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                {isEditMode ? 'Update' : 'Save'}
              </span>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
