import * as React from "react";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import {
  PLACEHOLDER_CATALOG,
  NAMESPACE_LABELS,
  type PlaceholderEntry,
  type PlaceholderNamespace,
} from "@/features/proposal-editor/placeholders";

interface ListProps extends SuggestionProps<PlaceholderEntry> {
  // herdado: items, command, query, etc.
}

interface ListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const PlaceholderList = React.forwardRef<ListRef, ListProps>((props, ref) => {
  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => setSelected(0), [props.items]);

  const select = (idx: number) => {
    const item = props.items[idx];
    if (item) {
      props.command({ id: item.key, label: item.key } as never);
    }
  };

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + props.items.length) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        select(selected);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="rounded-md border bg-popover p-2 text-xs text-muted-foreground shadow-md">
        Nenhuma variável encontrada
      </div>
    );
  }

  // Agrupa por namespace
  const grouped = new Map<PlaceholderNamespace, Array<{ item: PlaceholderEntry; idx: number }>>();
  props.items.forEach((item, idx) => {
    const list = grouped.get(item.namespace) ?? [];
    list.push({ item, idx });
    grouped.set(item.namespace, list);
  });

  return (
    <div className="max-h-72 w-72 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
      {Array.from(grouped.entries()).map(([ns, entries]) => (
        <div key={ns} className="mb-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {NAMESPACE_LABELS[ns]}
          </div>
          {entries.map(({ item, idx }) => (
            <button
              key={item.key}
              type="button"
              onClick={() => select(idx)}
              onMouseEnter={() => setSelected(idx)}
              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                idx === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              <span className="truncate">{item.label}</span>
              <code className="text-[10px] text-muted-foreground">{item.key}</code>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
});

PlaceholderList.displayName = "PlaceholderList";

/**
 * Extensão Tiptap Mention configurada para usar `{{` como gatilho.
 * Ao selecionar, insere literalmente `{{namespace.chave}}` no texto.
 */
export const PlaceholderMention = Mention.extend({
  name: "placeholderMention",
}).configure({
  HTMLAttributes: {
    class: "rounded bg-primary/10 px-1 py-0.5 text-primary font-mono text-[0.85em]",
  },
  renderText({ node }) {
    return `{{${node.attrs.id}}}`;
  },
  renderHTML({ node }) {
    return [
      "span",
      {
        class: "rounded bg-primary/10 px-1 py-0.5 text-primary font-mono text-[0.85em]",
        "data-placeholder": node.attrs.id,
      },
      `{{${node.attrs.id}}}`,
    ];
  },
  suggestion: {
    char: "{{",
    allowSpaces: false,
    startOfLine: false,
    items: ({ query }: { query: string }) => {
      const q = query.trim().toLowerCase();
      const filtered = q
        ? PLACEHOLDER_CATALOG.filter(
            (p) =>
              p.key.toLowerCase().includes(q) ||
              p.label.toLowerCase().includes(q) ||
              p.namespace.toLowerCase().includes(q),
          )
        : PLACEHOLDER_CATALOG;
      return filtered.slice(0, 30);
    },
    render: () => {
      let component: ReactRenderer<ListRef, ListProps> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps<PlaceholderEntry>) => {
          component = new ReactRenderer(PlaceholderList, { props, editor: props.editor });
          if (!props.clientRect) return;
          popup = tippy("body", {
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate(props: SuggestionProps<PlaceholderEntry>) {
          component?.updateProps(props);
          if (!props.clientRect || !popup) return;
          popup[0]?.setProps({
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          });
        },
        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  },
});
