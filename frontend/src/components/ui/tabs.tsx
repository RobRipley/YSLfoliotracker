import * as React from "react";

type TabsContextType = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextType | null>(null);

export interface TabsProps {
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  className = "",
  children,
}) => {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

type TabsListProps = {
  className?: string;
  children: React.ReactNode;
};

export const TabsList: React.FC<TabsListProps> = ({
  className = "",
  children,
}) => (
  <div
    className={
      "inline-flex items-center rounded-full bg-slate-900/80 p-1 border border-slate-800 " +
      className
    }
  >
    {children}
  </div>
);

type TabsTriggerProps = {
  value: string;
  className?: string;
  children: React.ReactNode;
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  className = "",
  children,
}) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>");
  const active = ctx.value === value;

  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={
        "px-3 py-1 text-xs rounded-full transition-colors " +
        (active
          ? "bg-indigo-500 text-white"
          : "text-slate-300 hover:bg-slate-800") +
        " " +
        className
      }
      type="button"
    >
      {children}
    </button>
  );
};

type TabsContentProps = {
  value: string;
  className?: string;
  children: React.ReactNode;
};

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  className = "",
  children,
}) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>");
  if (ctx.value !== value) return null;

  return <div className={className}>{children}</div>;
};