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
  return <SonnerToaster richColors closeButton {...props} />;
}

export const toast = sonnerToast;

export default Toaster;