import React from "react";

export function DashboardGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-12 gap-4">
            {children}
        </div>
    );
}
