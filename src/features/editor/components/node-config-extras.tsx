"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAtomValue } from "jotai";
import type { Edge, Node } from "@xyflow/react";
import { z } from "zod";
import {
  Button,
} from "@/components/ui/button";
import {
  ChevronDownIcon,
  FlaskConicalIcon,
  PlusIcon,
} from "lucide-react";
import { CredentialType, NodeType } from "@/generated/prisma";
import { NODE_MANIFESTS } from "@/features/workflows/node-manifest";
import { editorEdgesAtom, editorNodesAtom } from "../store/atoms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface TemplateVariable {
  token: string;
  description: string;
}

const TRIGGER_ROOT_SCHEMAS: Partial<Record<NodeType, z.ZodTypeAny>> = Object.fromEntries(
  NODE_MANIFESTS.map((manifest) => [manifest.type, manifest.outputSchema]),
) as Partial<Record<NodeType, z.ZodTypeAny>>;

/** Flattens a zod object schema into dotted paths, bounded by depth. */
function flattenZodPaths(
  schema: z.ZodTypeAny,
  prefix: string,
  depth: number,
  out: string[],
): void {
  if (depth > 3 || out.length > 40) return;

  const unwrapped =
    schema instanceof z.ZodOptional || schema instanceof z.ZodNullable
      ? schema.unwrap()
      : schema;

  if (unwrapped instanceof z.ZodObject) {
    for (const [key, value] of Object.entries(unwrapped.shape)) {
      const path = `${prefix}.${key}`;
      const inner =
        value instanceof z.ZodOptional || value instanceof z.ZodNullable
          ? value.unwrap()
          : value;
      if (inner instanceof z.ZodObject && depth < 3) {
        flattenZodPaths(inner, path, depth + 1, out);
      } else {
        out.push(path);
      }
    }
    return;
  }

  out.push(prefix);
}

/**
 * Computes template variables available to a node based on everything
 * upstream of it (trigger payloads + ancestor action outputs).
 */
export function useUpstreamVariables(nodeId: string): TemplateVariable[] {
  const nodes = useAtomValue(editorNodesAtom);
  const edges = useAtomValue(editorEdgesAtom);

  return useMemo(() => {
    const nodeById = new Map<string, Node>();
    for (const node of nodes) nodeById.set(node.id, node);

    // Reverse adjacency: target -> sources
    const incoming = new Map<string, string[]>();
    for (const edge of edges as Edge[]) {
      const list = incoming.get(edge.target) ?? [];
      list.push(edge.source);
      incoming.set(edge.target, list);
    }

    // Walk upstream breadth-first from this node.
    const visited = new Set<string>([nodeId]);
    const queue = [...(incoming.get(nodeId) ?? [])];
    const ancestors: Node[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = nodeById.get(id);
      if (node) ancestors.push(node);
      queue.push(...(incoming.get(id) ?? []));
    }

    const variables: TemplateVariable[] = [];

    for (const ancestor of ancestors) {
      const type = ancestor.type as NodeType;
      const schema = TRIGGER_ROOT_SCHEMAS[type];
      if (!schema) continue;

      if (
        type === NodeType.MANUAL_TRIGGER ||
        type === NodeType.INITIAL
      ) {
        continue;
      }

      let rootName: string;
      if (type === NodeType.GOOGLE_FORM_TRIGGER) {
        rootName = "";
      } else if (type === NodeType.STRIPE_TRIGGER) {
        rootName = "";
      } else {
        const variableName = (ancestor.data as Record<string, unknown>)
          ?.variableName;
        if (typeof variableName !== "string" || !variableName) continue;
        rootName = variableName;
      }

      const paths: string[] = [];
      if (rootName) {
        flattenZodPaths(schema, rootName, 1, paths);
      } else {
        flattenZodPaths(schema, "", 0, paths);
      }

      for (const rawPath of paths) {
        const path = rawPath.replace(/^\./, "");
        if (!path) continue;
        variables.push({
          token: `{{${path}}}`,
          description: `From ${type === NodeType.STRIPE_TRIGGER ? "Stripe event" : type === NodeType.GOOGLE_FORM_TRIGGER ? "form response" : ancestor.data?.variableName ? String(ancestor.data.variableName) : "upstream step"}`,
        });
        variables.push({
          token: `{{json ${path}}}`,
          description: "As formatted JSON",
        });
      }
    }

    // De-duplicate while preserving order.
    const seen = new Set<string>();
    return variables.filter((variable) => {
      if (seen.has(variable.token)) return false;
      seen.add(variable.token);
      return true;
    });
  }, [nodes, edges, nodeId]);
}

/**
 * Clickable chips that insert template tokens into a text field.
 */
export function TemplateVariablePicker({
  variables,
  onInsert,
}: {
  variables: TemplateVariable[];
  onInsert: (token: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (variables.length === 0) return null;

  const visible = expanded ? variables : variables.slice(0, 6);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {visible.map((variable) => (
          <button
            key={variable.token}
            type="button"
            title={variable.description}
            onClick={() => onInsert(variable.token)}
            className="inline-flex items-center rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-0.5 text-xs font-mono text-gray-600 dark:text-zinc-300 hover:border-[#5c54a4] hover:text-[#5c54a4] transition-colors"
          >
            {variable.token}
          </button>
        ))}
        {variables.length > 6 && (
          <button
            type="button"
            onClick={() => setExpanded((previous) => !previous)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? "Show less" : `+${variables.length - 6} more`}
            <ChevronDownIcon
              className={cn("size-3 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Runs a single node against its real provider using the current form
 * values and reports success/failure without touching the workflow graph.
 */
export function TestNodeButton({
  nodeType,
  values,
  className,
}: {
  nodeType: NodeType;
  values: Record<string, unknown>;
  className?: string;
}) {
  const trpc = useTRPC();
  const testNode = useMutation(
    trpc.workflows.testNode.mutationOptions(),
  );

  const handleTest = () => {
    testNode.mutate(
      { type: nodeType, data: values },
      {
        onSuccess: (result) => {
          if (result.ok) {
            toast.success("Step executed successfully", {
              description: JSON.stringify(result.output, null, 2).slice(0, 280),
              duration: 8000,
            });
          } else {
            toast.error(result.error.slice(0, 280), { duration: 8000 });
          }
        },
        onError: (error) => {
          toast.error(`Test failed: ${error.message}`);
        },
      },
    );
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={testNode.isPending}
      onClick={handleTest}
      className={className}
    >
      <FlaskConicalIcon className="size-4 mr-1.5" />
      {testNode.isPending ? "Testing…" : "Test step"}
    </Button>
  );
}

// PLACEHOLDER_CREDENTIAL_SELECT

/** Credential option as returned by credentials.getByType (value omitted). */
type CredentialOption = {
  id: string;
  name: string;
  type: CredentialType;
};

const CREDENTIAL_LOGOS: Partial<Record<CredentialType, string>> = {
  [CredentialType.OPENAI]: "/logos/openai.svg",
  [CredentialType.ANTHROPIC]: "/logos/anthropic.svg",
  [CredentialType.GEMINI]: "/logos/gemini.svg",
  [CredentialType.SMTP_EMAIL]: "/logos/email.svg",
  [CredentialType.GOOGLE_SHEETS]: "/logos/googlesheets.svg",
};

/**
 * Credential selector with an inline quick-create form so users are never
 * stuck on an empty dropdown.
 */
export function CredentialSelectWithCreate({
  credentialType,
  value,
  onChange,
  placeholder = "Select a credential",
}: {
  credentialType: CredentialType;
  value?: string;
  onChange: (credentialId: string) => void;
  placeholder?: string;
}) {
  const trpc = useTRPC();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [credentialValue, setCredentialValue] = useState("");

  const { data: credentials, isLoading } = useQuery(
    trpc.credentials.getByType.queryOptions({ type: credentialType }),
  );

  const createCredential = useMutation(
    trpc.credentials.create.mutationOptions({
      onSuccess: (created) => {
        toast.success(`Credential "${created.name}" created`);
        onChange(created.id);
        setCreating(false);
        setName("");
        setCredentialValue("");
      },
      onError: (error) => {
        toast.error(`Failed to create credential: ${error.message}`);
      },
    }),
  );

  if (creating) {
    return (
      <div className="space-y-3 rounded-xl border border-gray-200 dark:border-zinc-700 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My API key"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Value{" "}
            <span className="text-muted-foreground font-normal">
              (API key or JSON credential)
            </span>
          </Label>
          <Textarea
            value={credentialValue}
            onChange={(event) => setCredentialValue(event.target.value)}
            placeholder="sk-… or {&quot;host&quot;: …}"
            className="min-h-[70px] font-mono text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={
              !name.trim() ||
              !credentialValue.trim() ||
              createCredential.isPending
            }
            onClick={() =>
              createCredential.mutate({
                name: name.trim(),
                type: credentialType,
                value: credentialValue.trim(),
              })
            }
          >
            <PlusIcon className="size-3.5 mr-1" />
            Create
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setCreating(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const options = (credentials ?? []) as CredentialOption[];

  return (
    <div className="space-y-2">
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((credential) => (
            <SelectItem key={credential.id} value={credential.id}>
              <div className="flex items-center gap-2">
                <Image
                  src={CREDENTIAL_LOGOS[credential.type] ?? "/logos/openai.svg"}
                  alt={credential.name}
                  width={16}
                  height={16}
                />
                {credential.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="inline-flex items-center gap-1 text-xs text-[#5c54a4] hover:text-[#4a4387] dark:text-indigo-400 transition-colors"
      >
        <PlusIcon className="size-3" />
        Create new credential
      </button>
    </div>
  );
}
