"use client";

import { formatDistanceToNow } from "date-fns";
import {
  EmptyView,
  EntityContainer,
  EntityHeader,
  EntityItem,
  EntityList,
  EntityPagination,
  EntitySearch,
  EntitySkeletonList,
  ErrorView,
  LoadingView
} from "@/components/entity-components";
import { cn } from "@/lib/utils";
import { useRemoveCredential, useSuspenseCredentials } from "../hooks/use-credentials"
import { useRouter } from "next/navigation";
import { useCredentialsParams } from "../hooks/use-credentials-params";
import { useEntitySearch } from "@/hooks/use-entity-search";
import type { Credential } from "@/generated/prisma";
import { CredentialType } from "@/generated/prisma";
import Image from "next/image";
import { useQueryState } from "nuqs";
import { CredentialModal } from "./credential";

export const CredentialsSearch = () => {
  const [params, setParams] = useCredentialsParams();
  const { searchValue, onSearchChange } = useEntitySearch({
    params,
    setParams,
  });

  return (
    <EntitySearch
      value={searchValue}
      onChange={onSearchChange}
      placeholder="Search credentials"
    />
  );
};

export const CredentialsList = () => {
  const credentials = useSuspenseCredentials();

  return (
    <EntityList
      items={credentials.data.items}
      getKey={(credential) => credential.id}
      renderItem={(credential) => <CredentialItem data={credential} />}
      emptyView={<CredentialsEmpty />}
    />
  );
};

export const CredentialsHeader = ({ disabled, isOpen, onToggle }: { disabled?: boolean, isOpen?: boolean, onToggle?: () => void }) => {
  const [, setIsNew] = useQueryState("new");

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setIsNew("true");
    }
  };

  return (
    <EntityHeader
      title="Credentials"
      description="Create and manage your credentials"
      onNew={handleToggle}
      newButtonLabel="New credential"
      disabled={disabled}
      isOpen={isOpen}
    />
  );
};

export const CredentialsPagination = () => {
  const credentials = useSuspenseCredentials();
  const [params, setParams] = useCredentialsParams();

  return (
    <EntityPagination
      disabled={credentials.isFetching}
      totalPages={credentials.data.totalPages}
      page={credentials.data.page}
      onPageChange={(page) => setParams({ ...params, page })}
    />
  );
};

export const CredentialsContainer = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [isNew, setIsNew] = useQueryState("new");
  const [credentialId, setCredentialId] = useQueryState("edit");

  const isOpen = !!isNew || !!credentialId;
  const setIsOpen = (open: boolean) => {
    if (!open) {
      setIsNew(null);
      setCredentialId(null);
    } else {
      setIsNew("true");
    }
  };

  return (
    <div className="flex flex-row h-full w-full overflow-hidden min-h-0">
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 transition-all duration-300">
        <div className="h-full overflow-y-auto">
          <EntityContainer
            header={<CredentialsHeader isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />}
            search={<CredentialsSearch />}
            pagination={<CredentialsPagination />}
          >
            {children}
          </EntityContainer>
        </div>
      </div>
        
      <aside 
        className={cn(
          "shrink-0 h-full overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out flex flex-col min-h-0",
          isOpen ? "w-[400px] ml-2 opacity-100" : "w-0 ml-0 opacity-0"
        )}
      >
        <div className="w-full h-full bg-[#f6f8fb] dark:bg-zinc-950 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm overflow-hidden flex flex-col">
          <CredentialModal 
            isOpen={isOpen} 
            setIsOpen={setIsOpen} 
            credentialId={credentialId} 
          />
        </div>
      </aside>
    </div>
  );
};

export const CredentialsLoading = () => {
  return <EntitySkeletonList count={6} />;
};

export const CredentialsError = () => {
  return <ErrorView message="Error loading credentials" />;
};

export const CredentialsEmpty = () => {
  const [, setIsNew] = useQueryState("new");

  return (
    <EmptyView
      onNew={() => setIsNew("true")}
      message="You haven't created any credentials yet. Get started by creating your first credential"
    />
  );
};

const credentialLogos: Record<CredentialType, string> = {
  [CredentialType.OPENAI]: "/logos/openai.svg",
  [CredentialType.ANTHROPIC]: "/logos/anthropic.svg",
  [CredentialType.GEMINI]: "/logos/gemini.svg",
  [CredentialType.SMTP_EMAIL]: "/logos/email.svg",
  [CredentialType.GOOGLE_SHEETS]: "/logos/googlesheets.svg",
};

export const CredentialItem = ({
  data,
}: {
  data: Credential
}) => {
  const removeCredential = useRemoveCredential();
  const [credentialId, setCredentialId] = useQueryState("edit");

  const handleRemove = () => {
    removeCredential.mutate({ id: data.id });
  };

  const logo = credentialLogos[data.type] || "/logos/openai.svg";

  return (
    <EntityItem
      isSelected={credentialId === data.id}
      onClick={() => setCredentialId(data.id)}
      title={data.name}
      subtitle={
        <>
          Updated {formatDistanceToNow(data.updatedAt, { addSuffix: true })}{" "}
          &bull; Created{" "}
          {formatDistanceToNow(data.createdAt, { addSuffix: true })}
        </>
      }
      image={
        <div className="size-[50px] rounded-2xl bg-gradient-to-br from-[#e8e9f5] to-[#f4f3fb] dark:from-[#2a2a2c] dark:to-[#1a1a1c] flex items-center justify-center flex-shrink-0 border border-white dark:border-white/5 shadow-sm dark:shadow-none transition-transform group-hover:scale-105">
          <Image src={logo} alt={data.type} width={26} height={26} />
        </div>
      }
      onRemove={handleRemove}
      isRemoving={removeCredential.isPending}
    />
  )
};
