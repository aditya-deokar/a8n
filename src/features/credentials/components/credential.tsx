"use client";

import { CredentialType } from "@/generated/prisma";
import Image from "next/image";
import { 
  useCreateCredential, 
  useUpdateCredential,
  useSuspenseCredential,
} from "../hooks/use-credentials";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(CredentialType),
  value: z.string().min(1, "API key is required"),
});

type FormValues = z.infer<typeof formSchema>;

const credentialTypeOptions = [
  {
    value: CredentialType.OPENAI,
    label: "OpenAI",
    logo: "/logos/openai.svg",
  },
  {
    value: CredentialType.ANTHROPIC,
    label: "Anthropic",
    logo: "/logos/anthropic.svg",
  },
  {
    value: CredentialType.GEMINI,
    label: "Gemini",
    logo: "/logos/gemini.svg",
  },
  {
    value: CredentialType.SMTP_EMAIL,
    label: "SMTP Email",
    logo: "/logos/email.svg",
  },
  {
    value: CredentialType.GOOGLE_SHEETS,
    label: "Google Sheets",
    logo: "/logos/googlesheets.svg",
  },
];

interface CredentialFormProps {
  initialData?: {
    id?: string;
    name: string;
    type: CredentialType;
    value: string;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
};

export const CredentialForm = ({
  initialData,
  onSuccess: onSuccessCallback,
  onCancel,
}: CredentialFormProps) => {
  const createCredential = useCreateCredential();
  const updateCredential = useUpdateCredential();
  const { handleError, modal } = useUpgradeModal();

  const isEdit = !!initialData?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      type: CredentialType.OPENAI,
      value: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (isEdit && initialData?.id) {
      await updateCredential.mutateAsync({
        id: initialData.id,
        ...values,
      }).then(() => {
        onSuccessCallback?.();
      });
    } else {
      await createCredential.mutateAsync(values, {
        onSuccess: (data) => {
          onSuccessCallback?.();
        },
        onError: (error) => {
          handleError(error);
        }
      })
    }
  }

  return (
    <>
      {modal}
      <div className="flex flex-col h-full bg-white dark:bg-[#0f0f11]">
        <div className="pb-4 pt-6 px-6 border-b border-gray-100 dark:border-zinc-800/50 flex-shrink-0">
          <h2 className="text-xl font-semibold tracking-tight">
            {isEdit ? "Edit Credential" : "Create Credential"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isEdit
              ? "Update your API key or credential details"
              : "Add a new API key or credential to your account"}
          </p>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
          <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex flex-col gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="My API key" 
                            className="rounded-xl bg-gray-50/50 dark:bg-zinc-900/80 border-gray-200/60 dark:border-zinc-800 h-12 px-4 shadow-inner dark:shadow-none focus-visible:ring-2 focus-visible:ring-[#5c54a4]/20 focus-visible:border-[#5c54a4] transition-all"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage className="ml-1" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full rounded-xl bg-gray-50/50 dark:bg-zinc-900/80 border-gray-200/60 dark:border-zinc-800 !h-12 px-4 focus:ring-2 focus:ring-[#5c54a4]/20 focus:border-[#5c54a4] transition-all">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-2xl border-white/5 shadow-2xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl p-1.5 overflow-hidden">
                          {credentialTypeOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-[#5c54a4] focus:text-white transition-colors duration-200 data-[state=checked]:bg-[#5c54a4]/10 data-[state=checked]:text-[#5c54a4] dark:data-[state=checked]:text-white"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-1 rounded-md shadow-sm">
                                  <Image
                                    src={option.logo}
                                    alt={option.label}
                                    width={20}
                                    height={20}
                                    className="rounded-[4px]"
                                  />
                                </div>
                                <span className="font-medium text-[15px]">{option.label}</span>
                              </div>
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
                    name="value"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">API Key</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="sk-..."
                            className="rounded-xl bg-gray-50/50 dark:bg-zinc-900/80 border-gray-200/60 dark:border-zinc-800 h-12 px-4 shadow-inner dark:shadow-none focus-visible:ring-2 focus-visible:ring-[#5c54a4]/20 focus-visible:border-[#5c54a4] transition-all"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="ml-1" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-3 pt-6 mt-auto">
                  <Button
                    type="submit"
                    className="w-full rounded-xl h-12 bg-[#5c54a4] hover:bg-[#4a4387] text-white font-semibold text-[15px] shadow-md shadow-[#5c54a4]/20 transition-all active:scale-[0.98]"
                    disabled={
                      createCredential.isPending ||
                      updateCredential.isPending
                    }
                  >
                    {isEdit ? "Update" : "Create"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full rounded-xl h-12 hover:bg-gray-100 dark:hover:bg-zinc-900/50 text-gray-700 dark:text-gray-300 font-semibold text-[15px] transition-all active:scale-[0.98]"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
          </Form>
        </div>
      </div>
    </>
  )
};

export const CredentialView = ({
  credentialId,
  onSuccess,
  onCancel,
}: { 
  credentialId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) => {
  const { data: credential } = useSuspenseCredential(credentialId);

  return <CredentialForm initialData={credential} onSuccess={onSuccess} onCancel={onCancel} />
};

export const CredentialModal = ({
  isOpen,
  setIsOpen,
  credentialId,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  credentialId?: string | null;
}) => {
  return (
    <div className="flex flex-col h-full w-full relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-4 right-4 z-10 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
        onClick={() => setIsOpen(false)}
      >
        <XIcon className="size-4" />
      </Button>
      {credentialId ? (
        <CredentialView 
          key={credentialId}
          credentialId={credentialId} 
          onSuccess={() => setIsOpen(false)}
          onCancel={() => setIsOpen(false)}
        />
      ) : (
        <CredentialForm 
          key="new"
          onSuccess={() => setIsOpen(false)}
          onCancel={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
