/**
 * Fork feature (docs/2026-10-11-description-tabs.md): the work item description as tabs, one per heading.
 */

import type { ComponentProps, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { cn } from "@plane/utils";
// components
import { RichTextEditor } from "@/components/editor/rich-text";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useWorkspace } from "@/hooks/store/use-workspace";
// local imports
import { isEmptyDescription, NO_TEST_STEPS_TEXT, openingTabIndex, splitDescription } from "./split-description";

type TDescriptionInputProps = Omit<ComponentProps<typeof DescriptionInput>, "key">;

type Props = TDescriptionInputProps & {
  /** State of the work item; "Testing" opens on the How to Test tab. */
  stateId?: string | null;
};

const READ_ONLY_CLASS = "p-0! pl-0! border-none";

export const DescriptionTabs = observer(function DescriptionTabs(props: Props) {
  const { stateId, initialValue, editorRef, disabled, ...inputProps } = props;
  const { entityId, workspaceSlug, projectId } = inputProps;
  // store hooks
  const { getStateById } = useProjectState();
  const { getWorkspaceBySlug } = useWorkspace();
  // states
  // an empty description keeps the upstream editor; it stays an editor while the first text is typed
  const [isEditing, setIsEditing] = useState(() => isEmptyDescription(initialValue));
  const [canFinish] = useState(() => !isEmptyDescription(initialValue));
  const [html, setHtml] = useState(initialValue ?? "");
  const [tabState, setTabState] = useState<{ index: number | null }>({ index: null });
  // refs
  const ownEditorRef = useRef<EditorRefApi>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeEditorRef = editorRef ?? ownEditorRef;
  // derived values
  const stateName = stateId ? getStateById(stateId)?.name : undefined;
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id;
  const { intro, sections } = useMemo(() => splitDescription(html), [html]);
  const activeIndex = Math.min(tabState.index ?? openingTabIndex(sections.length, stateName), sections.length - 1);
  const active = sections[activeIndex];

  // follow saves from elsewhere (version restore, another client) while not editing
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;
  useEffect(() => {
    if (!isEditingRef.current) setHtml(initialValue ?? "");
  }, [initialValue]);

  const finishEditing = () => {
    const latest = activeEditorRef.current?.getDocument().html;
    if (latest) setHtml(latest);
    // leaving unmounts the editor, which saves any unsaved change through the normal upstream path
    setIsEditing(false);
    setTabState({ index: null });
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (activeIndex + (event.key === "ArrowRight" ? 1 : sections.length - 1)) % sections.length;
    setTabState({ index: next });
    tabRefs.current[next]?.focus();
  };

  if (isEditing || !workspaceId || sections.length === 0) {
    return (
      <div>
        {isEditing && canFinish && (
          <div className="flex items-center justify-between gap-3 pb-2">
            <span className="text-12 text-tertiary">
              Editing the whole description. Headings become tabs again when you press Done.
            </span>
            <button
              type="button"
              className="flex-shrink-0 rounded-md bg-accent-primary px-2.5 py-1 text-12 font-medium text-on-color hover:opacity-90"
              onClick={finishEditing}
            >
              Done
            </button>
          </div>
        )}
        <DescriptionInput
          {...inputProps}
          key={entityId}
          initialValue={html}
          disabled={disabled}
          editorRef={activeEditorRef}
        />
      </div>
    );
  }

  const readOnly = (id: string, value: string) => (
    <RichTextEditor
      key={id}
      editable={false}
      containerClassName={READ_ONLY_CLASS}
      editorClassName="pl-0"
      id={id}
      initialValue={value}
      projectId={projectId}
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
    />
  );

  return (
    <div className="min-w-0">
      {intro && <div className="mb-1">{readOnly(`${entityId}-intro-${intro.length}`, intro)}</div>}
      <div className="mt-3 flex items-end justify-between gap-3 border-b border-subtle">
        <div
          role="tablist"
          aria-label="Description sections"
          className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]"
        >
          {sections.map((section, index) => {
            const selected = index === activeIndex;
            return (
              <button
                // oxlint-disable-next-line react/no-array-index-key -- headings can repeat
                key={`${index}-${section.name}`}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`${entityId}-tab-${index}`}
                aria-selected={selected}
                aria-controls={`${entityId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTabState({ index })}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "focus-visible:ring-accent-primary relative flex-shrink-0 rounded-t-md px-3 pt-2.5 pb-3 text-13 font-medium whitespace-nowrap outline-none hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-inset",
                  selected ? "text-accent-primary" : section.isEmpty ? "text-tertiary" : "text-secondary"
                )}
              >
                {section.name}
                {selected && <span className="absolute right-2 bottom-[-1px] left-2 h-0.5 rounded bg-accent-primary" />}
              </button>
            );
          })}
        </div>
        {!disabled && (
          <button
            type="button"
            className="mb-1.5 flex-shrink-0 rounded-md border border-strong px-2.5 py-1 text-12 font-medium text-secondary hover:bg-layer-transparent-hover hover:text-primary"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
        )}
      </div>
      <div
        role="tabpanel"
        id={`${entityId}-panel`}
        aria-labelledby={`${entityId}-tab-${activeIndex}`}
        className="min-h-[120px] pt-4 pb-2"
      >
        {active.meta && <p className="mb-2 text-12 text-tertiary">{active.meta}</p>}
        {active.isEmpty ? (
          <p className="text-13 text-tertiary italic">{NO_TEST_STEPS_TEXT}</p>
        ) : (
          readOnly(`${entityId}-section-${activeIndex}-${active.html.length}`, active.html)
        )}
      </div>
    </div>
  );
});
