import * as React from "react";

type Props = {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export function EditorA4Page({ children, header, footer }: Props) {
  return (
    <div className="mx-auto mb-6 w-full max-w-[794px] rounded-xl border bg-white shadow-sm">
      <div className="min-h-[1123px] flex flex-col">
        {header ? <div className="border-b">{header}</div> : null}
        <div className="flex-1 px-10 py-8">{children}</div>
        {footer ? <div className="border-t">{footer}</div> : null}
      </div>
    </div>
  );
}
