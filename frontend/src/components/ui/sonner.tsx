import React from "react";
import {
  Toaster as SonnerToaster,
  toast as sonnerToast,
  ToasterProps,
} from "sonner";

/**
 * Simple wrapper so we can import `{ Toaster, toast }` from "@/components/ui/sonner"
 * like in a typical shadcn setup.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      richColors
      closeButton
      duration={2500}
      toastOptions={{
        style: {
          background: 'hsl(215 25% 16%)',
          border: '1px solid hsl(215 20% 25%)',
          color: 'hsl(210 20% 88%)',
          fontSize: '13px',
        },
      }}
      {...props}
    />
  );
}

export const toast = sonnerToast;

export default Toaster;