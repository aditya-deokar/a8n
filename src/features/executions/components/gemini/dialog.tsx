"use client";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NodeDialogContent } from "@/components/node-dialog";
import { Textarea } from "@/components/ui/textarea";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  CredentialSelectWithCreate,
  TemplateVariablePicker,
  TestNodeButton,
  useUpstreamVariables,
} from "@/features/editor/components/node-config-extras";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CredentialType, NodeType } from "@/generated/prisma";

const formSchema = z.object({
  variableName: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, { 
      message: "Variable name must start with a letter or underscore and container only letters, numbers, and underscores",
    }),
  credentialId: z.string().min(1, "Credential is required"),
  model: z.string().min(1),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1, "User prompt is required"),
});

export const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

export type GeminiFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  defaultValues?: Partial<GeminiFormValues>;
  nodeId?: string;
};

export const GeminiDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
  nodeId,
}: Props) => {
  const variables = useUpstreamVariables(nodeId ?? "");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variableName: defaultValues.variableName || "",
      credentialId: defaultValues.credentialId || "",
      model: defaultValues.model || "gemini-2.5-flash",
      systemPrompt: defaultValues.systemPrompt || "",
      userPrompt: defaultValues.userPrompt || "",
    },
  });

  // Reset form values when dialog opens with new defaults
  useEffect(() => {
    if (open) {
      form.reset({
        variableName: defaultValues.variableName || "",
        credentialId: defaultValues.credentialId || "",
        model: defaultValues.model || "gemini-2.5-flash",
        systemPrompt: defaultValues.systemPrompt || "",
        userPrompt: defaultValues.userPrompt || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariableName = form.watch("variableName") || "myGemini";

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <NodeDialogContent>
        <DialogHeader>
          <DialogTitle>Gemini Configuration</DialogTitle>
          <DialogDescription>
            Configure the AI model and prompts for this node.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-8 mt-4"
          >
            <FormField
              control={form.control}
              name="variableName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variable Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="myGemini"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the result in other nodes:{" "}
                    {`{{${watchVariableName}.text}}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GEMINI_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credentialId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gemini Credential</FormLabel>
                  <FormControl>
                    <CredentialSelectWithCreate
                      credentialType={CredentialType.GEMINI}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select a credential"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="systemPrompt"
              render={({ field }) => (
              <FormItem>
                <FormLabel>System Prompt (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="You are a helpful assistant."
                    className="min-h-[80px] font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                  <FormDescription>
                    Sets the behavior of the assistant. Use {"{{variables}}"} for simple values or {"{{json variable}}"} to stringify objects
                  </FormDescription>
                  <TemplateVariablePicker
                    variables={variables}
                    onInsert={(token) =>
                      field.onChange(`${String(field.value ?? "")}${token}`)
                    }
                  />
                <FormMessage />
              </FormItem>
            )}
            />
            <FormField
              control={form.control}
              name="userPrompt"
              render={({ field }) => (
              <FormItem>
                <FormLabel>User Prompt</FormLabel>
                <FormControl>
                  <Textarea
                     placeholder="Summarize this text: {{json httpResponse.data}}"
                    className="min-h-[120px] font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                  <FormDescription>
                    The prompt to send to the AI. Use {"{{variables}}"} for simple values or {"{{json variable}}"} to stringify objects
                  </FormDescription>
                  <TemplateVariablePicker
                    variables={variables}
                    onInsert={(token) =>
                      field.onChange(`${String(field.value ?? "")}${token}`)
                    }
                  />
                <FormMessage />
              </FormItem>
            )}
            />
            <DialogFooter className="mt-4 flex-row gap-2">
              {nodeId && (
                <TestNodeButton
                  nodeType={NodeType.GEMINI}
                  values={form.watch()}
                  className="mr-auto"
                />
              )}
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </NodeDialogContent>
    </Dialog>
  );
};
