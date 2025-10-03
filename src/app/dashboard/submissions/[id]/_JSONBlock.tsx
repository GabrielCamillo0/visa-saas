"use client";

import * as React from "react";

export default function JSONBlock({ data, collapsed = false }: { data: any; collapsed?: boolean }) {
  const [open, setOpen] = React.useState(!collapsed);
  return (
    <div>
      <button
        type="button"
        className="text-xs underline mb-2"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Recolher" : "Expandir"}
      </button>
      {open && (
        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
